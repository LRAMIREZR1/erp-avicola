"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hoyChile } from "@/lib/format";
import { obtenerRolActual } from "@/lib/roles";
import type { EstadoPedido } from "@/lib/supabase/types";

interface LineaPedido {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
}

// Estado que devuelven crearPedido/editarPedido para usarse con
// useActionState desde PedidoForm: en vez de lanzar un error (que en
// producción llega al navegador sin el mensaje), devuelven el motivo para
// mostrarlo directamente en el formulario.
export type PedidoFormState = { error?: string };

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

export async function crearPedido(
  _prevState: PedidoFormState,
  formData: FormData
): Promise<PedidoFormState> {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const rol = await obtenerRolActual();

  const clienteId = String(formData.get("cliente_id"));
  const fechaEntrega = (formData.get("fecha_entrega") as string) || null;
  const notas = (formData.get("notas") as string) || null;
  const motivoDescuento = (formData.get("motivo_descuento") as string) || null;
  const pagado = formData.get("pagado") === "on";
  const itemsRaw = String(formData.get("items") ?? "[]");
  const items: LineaPedido[] = JSON.parse(itemsRaw).filter(
    (i: LineaPedido) => i.producto_id && i.cantidad > 0
  );

  if (!clienteId) return { error: "Debes seleccionar un cliente" };
  if (items.length === 0) return { error: "Agrega al menos un producto al pedido" };

  // Solo el administrador puede dejar el pedido a nombre de otro vendedor;
  // para cualquier otro rol (o si no eligió a nadie) queda con su propia
  // cuenta, ignorando lo que venga en el formulario por seguridad.
  const vendedorIdElegido = (formData.get("vendedor_id") as string) || "";
  const vendedorId = rol === "administrador" && vendedorIdElegido ? vendedorIdElegido : user?.id ?? null;

  const precioListaMap = await obtenerPreciosLista(
    supabase,
    items.map((i) => i.producto_id)
  );

  const { data: pedido, error } = await supabase
    .from("pedidos")
    .insert({
      cliente_id: clienteId,
      vendedor_id: vendedorId,
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
    return { error: "No se pudo crear el pedido: " + error?.message };
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

// Para el reparto: marca uno o varios pedidos (del mismo cliente, entregados
// juntos) como "entregado" y, si el repartidor cobró en efectivo al hacer la
// entrega, deja el pedido pagado en el mismo paso — así no hay que ir
// después a Cobranzas a marcarlo aparte.
export async function marcarEntregadoConCobro(pedidoIds: string[], cobrado: boolean) {
  "use server";
  const rol = await obtenerRolActual();
  if (rol !== "administrador" && rol !== "repartidor") return;

  const supabase = await createClient();
  const hoy = hoyChile();

  for (const pedidoId of pedidoIds) {
    const cambios: Record<string, unknown> = {
      estado: "entregado",
      fecha_entregado: hoy,
    };
    if (cobrado) {
      cambios.pagado = true;
      cambios.fecha_pago = hoy;
    }
    await supabase.from("pedidos").update(cambios).eq("id", pedidoId);
  }

  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/reparto");
  revalidatePath("/admin/reparto/historial");
  revalidatePath("/admin/cobranzas");
  revalidatePath("/admin/reportes");
  revalidatePath("/admin/productos");
  revalidatePath("/admin");
  for (const pedidoId of pedidoIds) {
    revalidatePath(`/admin/pedidos/${pedidoId}`);
  }
}

export async function editarPedido(
  pedidoId: string,
  _prevState: PedidoFormState,
  formData: FormData
): Promise<PedidoFormState> {
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

  if (!clienteId) return { error: "Debes seleccionar un cliente" };
  if (items.length === 0) return { error: "Agrega al menos un producto al pedido" };

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
    return { error: "No se pudo actualizar el pedido: " + updateError.message };
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
    return { error: "No se pudieron actualizar los productos del pedido: " + itemsError.message };
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
// que usa cancelar); al restaurar, se vuelve a descontar. Devuelve el error
// en vez de lanzarlo para que el botón pueda mostrarlo con un alert.
export async function borrarPedido(pedidoId: string): Promise<{ error?: string } | undefined> {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase.rpc("eliminar_pedido", { p_pedido_id: pedidoId });

  if (error) {
    return { error: "No se pudo eliminar el pedido: " + error.message };
  }

  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  revalidatePath("/admin/productos");
  redirect("/admin/pedidos");
}

export async function restaurarPedido(
  pedidoId: string
): Promise<{ error?: string } | undefined> {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase.rpc("restaurar_pedido", { p_pedido_id: pedidoId });

  if (error) {
    return { error: "No se pudo restaurar el pedido: " + error.message };
  }

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${pedidoId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/productos");
  revalidatePath("/admin/cobranzas");
  revalidatePath("/admin/reparto");
}

// Borrado definitivo (distinto de "eliminar"): saca el pedido de la base de
// datos de verdad, sin dejarlo recuperable desde "Eliminados". Por
// seguridad, solo se puede aplicar a un pedido que ya esté en estado
// "eliminado" — no reemplaza el borrado normal, es para limpiar pedidos que
// ya se sabe que no sirven de nada (ej. cargados por error de prueba).
export async function borrarPedidoDefinitivo(
  pedidoId: string
): Promise<{ error?: string } | undefined> {
  "use server";
  const supabase = await createClient();

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("estado")
    .eq("id", pedidoId)
    .single();

  if (!pedido) {
    return { error: "El pedido ya no existe" };
  }
  if (pedido.estado !== "eliminado") {
    return {
      error: 'Solo se pueden borrar definitivamente pedidos que ya estén en "Eliminados"',
    };
  }

  const { error } = await supabase.from("pedidos").delete().eq("id", pedidoId);

  if (error) {
    return { error: "No se pudo borrar el pedido: " + error.message };
  }

  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  redirect("/admin/pedidos");
}
