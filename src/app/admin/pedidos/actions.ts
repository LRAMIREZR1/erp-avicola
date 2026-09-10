"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hoyChile } from "@/lib/format";
import type { EstadoPedido } from "@/lib/supabase/types";

interface LineaPedido {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
}

// Trae el precio de catálogo actual de cada producto, para guardarlo como
// "precio de lista" junto al precio realmente cobrado (permite trackear descuentos).
async function obtenerPreciosLista(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productoIds: string[]
): Promise<Map<string, number>> {
  const idsUnicos = [...new Set(productoIds)];
  if (idsUnicos.length === 0) return new Map();
  const { data } = await supabase.from("productos").select("id, precio").in("id", idsUnicos);
  return new Map((data ?? []).map((p) => [p.id, Number(p.precio)]));
}

// stock_actual solo se descuenta cuando un pedido llega a "confirmado" (o
// más adelante), así que mientras está recién creado (pendiente) refleja el
// stock realmente disponible — comparamos directo contra eso. Si el pedido
// que se está editando ya estaba en un estado que compromete stock
// (confirmado / en_preparacion / entregado), sus propias cantidades ya están
// restadas de stock_actual, así que se devuelven a la bolsa disponible antes
// de comparar (editar_items_pedido hace exactamente lo mismo: repone y
// vuelve a descontar).
async function verificarStockDisponible(
  supabase: Awaited<ReturnType<typeof createClient>>,
  items: LineaPedido[],
  pedidoActualId?: string
) {
  const idsUnicos = [...new Set(items.map((i) => i.producto_id))];
  if (idsUnicos.length === 0) return;

  const { data: productos } = await supabase
    .from("productos")
    .select("id, nombre, stock_actual")
    .in("id", idsUnicos);

  const stockMap = new Map(
    (productos ?? []).map((p) => [p.id, { nombre: p.nombre, stock: Number(p.stock_actual) }])
  );

  const reservaPropia = new Map<string, number>();
  if (pedidoActualId) {
    const { data: pedidoActual } = await supabase
      .from("pedidos")
      .select("estado")
      .eq("id", pedidoActualId)
      .single();

    const compromete =
      !!pedidoActual && ["confirmado", "en_preparacion", "entregado"].includes(pedidoActual.estado);

    if (compromete) {
      const { data: itemsActuales } = await supabase
        .from("pedido_items")
        .select("producto_id, cantidad")
        .eq("pedido_id", pedidoActualId);

      for (const it of itemsActuales ?? []) {
        reservaPropia.set(it.producto_id, (reservaPropia.get(it.producto_id) ?? 0) + it.cantidad);
      }
    }
  }

  // Suma las cantidades por producto: el formulario podría repetir el mismo
  // producto en más de una línea.
  const solicitado = new Map<string, number>();
  for (const i of items) {
    solicitado.set(i.producto_id, (solicitado.get(i.producto_id) ?? 0) + i.cantidad);
  }

  for (const [productoId, cantidadSolicitada] of solicitado) {
    const producto = stockMap.get(productoId);
    if (!producto) continue;
    const disponible = producto.stock + (reservaPropia.get(productoId) ?? 0);
    if (cantidadSolicitada > disponible) {
      throw new Error(
        `No hay stock suficiente de "${producto.nombre}" (disponible: ${disponible}, solicitado: ${cantidadSolicitada}). Por favor contacta directamente a la avícola para coordinar este pedido.`
      );
    }
  }
}

export async function crearPedido(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const clienteId = String(formData.get("cliente_id"));
  const fechaEntrega = (formData.get("fecha_entrega") as string) || null;
  const notas = (formData.get("notas") as string) || null;
  const motivoDescuento = (formData.get("motivo_descuento") as string) || null;
  const pagado = formData.get("pagado") === "on";
  const itemsRaw = String(formData.get("items") ?? "[]");
  const items: LineaPedido[] = JSON.parse(itemsRaw).filter(
    (i: LineaPedido) => i.producto_id && i.cantidad > 0
  );

  if (!clienteId) throw new Error("Debes seleccionar un cliente");
  if (items.length === 0) throw new Error("Agrega al menos un producto al pedido");

  await verificarStockDisponible(supabase, items);

  const precioListaMap = await obtenerPreciosLista(
    supabase,
    items.map((i) => i.producto_id)
  );

  const { data: pedido, error } = await supabase
    .from("pedidos")
    .insert({
      cliente_id: clienteId,
      vendedor_id: user?.id ?? null,
      fecha_pedido: hoyChile(),
      fecha_entrega: fechaEntrega,
      notas,
      motivo_descuento: motivoDescuento,
      pagado,
      fecha_pago: pagado ? hoyChile() : null,
    })
    .select("id")
    .single();

  if (error || !pedido) {
    throw new Error("No se pudo crear el pedido: " + error?.message);
  }

  await supabase.from("pedido_items").insert(
    items.map((i) => ({
      pedido_id: pedido.id,
      producto_id: i.producto_id,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      precio_lista: precioListaMap.get(i.producto_id) ?? i.precio_unitario,
    }))
  );

  revalidatePath("/admin/pedidos");
  redirect(`/admin/pedidos/${pedido.id}`);
}

export async function cambiarEstadoPedido(pedidoId: string, estado: EstadoPedido) {
  "use server";
  const supabase = await createClient();
  await supabase
    .from("pedidos")
    .update({
      estado,
      // Se fija (o se limpia, si se revierte desde "entregado") el día
      // calendario real en que se entregó, para el historial de repartos.
      fecha_entregado: estado === "entregado" ? hoyChile() : null,
    })
    .eq("id", pedidoId);
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${pedidoId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/productos");
  revalidatePath("/admin/reparto");
  revalidatePath("/admin/reparto/historial");
}

export async function editarPedido(pedidoId: string, formData: FormData) {
  "use server";
  const supabase = await createClient();

  const clienteId = String(formData.get("cliente_id"));
  const fechaEntrega = (formData.get("fecha_entrega") as string) || null;
  const notas = (formData.get("notas") as string) || null;
  const motivoDescuento = (formData.get("motivo_descuento") as string) || null;
  const pagado = formData.get("pagado") === "on";
  const itemsRaw = String(formData.get("items") ?? "[]");
  const items: LineaPedido[] = JSON.parse(itemsRaw).filter(
    (i: LineaPedido) => i.producto_id && i.cantidad > 0
  );

  if (!clienteId) throw new Error("Debes seleccionar un cliente");
  if (items.length === 0) throw new Error("Agrega al menos un producto al pedido");

  await verificarStockDisponible(supabase, items, pedidoId);

  const { data: pedidoActual } = await supabase
    .from("pedidos")
    .select("pagado, fecha_pago")
    .eq("id", pedidoId)
    .single();

  const { error: updateError } = await supabase
    .from("pedidos")
    .update({
      cliente_id: clienteId,
      fecha_entrega: fechaEntrega,
      notas,
      motivo_descuento: motivoDescuento,
      pagado,
      // Si ya estaba pagado y sigue marcado, se conserva la fecha original
      // en la que se registró el pago en vez de pisarla con la de hoy.
      fecha_pago: pagado ? pedidoActual?.fecha_pago ?? hoyChile() : null,
    })
    .eq("id", pedidoId);

  if (updateError) {
    throw new Error("No se pudo actualizar el pedido: " + updateError.message);
  }

  const precioListaMap = await obtenerPreciosLista(
    supabase,
    items.map((i) => i.producto_id)
  );

  const { error: itemsError } = await supabase.rpc("editar_items_pedido", {
    p_pedido_id: pedidoId,
    p_items: items.map((i) => ({
      ...i,
      precio_lista: precioListaMap.get(i.producto_id) ?? i.precio_unitario,
    })),
  });

  if (itemsError) {
    throw new Error("No se pudieron actualizar los productos del pedido: " + itemsError.message);
  }

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${pedidoId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/productos");
  redirect(`/admin/pedidos/${pedidoId}`);
}

// "Borrar" un pedido ya no lo elimina físicamente: lo pasa a un estado
// especial "eliminado" (recuperable desde el filtro "Eliminados"), guardando
// en qué estado estaba para poder devolverlo ahí con restaurarPedido. Si el
// pedido tenía stock comprometido, se repone automáticamente (mismo trigger
// que usa cancelar); al restaurar, se vuelve a descontar.
export async function borrarPedido(pedidoId: string) {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase.rpc("eliminar_pedido", { p_pedido_id: pedidoId });

  if (error) {
    throw new Error("No se pudo eliminar el pedido: " + error.message);
  }

  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  revalidatePath("/admin/productos");
  redirect("/admin/pedidos");
}

export async function restaurarPedido(pedidoId: string) {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase.rpc("restaurar_pedido", { p_pedido_id: pedidoId });

  if (error) {
    throw new Error("No se pudo restaurar el pedido: " + error.message);
  }

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${pedidoId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/productos");
  revalidatePath("/admin/cobranzas");
  revalidatePath("/admin/reparto");
}

// Borrado definitivo (DELETE real, sin vuelta atrás) de un pedido que ya
// está en "Eliminados" — para que Administrador pueda limpiar la base de
// datos. La función en la base valida que sea administrador y que el
// pedido ya esté eliminado; los movimientos de stock asociados se
// conservan (solo se desvincula el pedido_id) para no perder la auditoría
// del inventario.
export async function borrarPedidoDefinitivo(pedidoId: string) {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase.rpc("eliminar_pedido_definitivo", { p_pedido_id: pedidoId });

  if (error) {
    throw new Error("No se pudo borrar definitivamente el pedido: " + error.message);
  }

  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  revalidatePath("/admin/productos");
}
