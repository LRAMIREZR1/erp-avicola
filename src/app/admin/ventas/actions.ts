"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hoyChile } from "@/lib/format";
import { requireRol } from "@/lib/roles";

interface LineaVenta {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
}

export async function crearVentaDirecta(formData: FormData) {
  await requireRol(["administrador"]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const clienteId = String(formData.get("cliente_id"));
  const notas = (formData.get("notas") as string) || null;
  const motivoDescuento = (formData.get("motivo_descuento") as string) || null;
  const pagado = formData.get("pagado") === "on";
  const itemsRaw = String(formData.get("items") ?? "[]");
  const items: LineaVenta[] = JSON.parse(itemsRaw).filter(
    (i: LineaVenta) => i.producto_id && i.cantidad > 0
  );

  if (!clienteId) throw new Error("Debes seleccionar un cliente");
  if (items.length === 0) throw new Error("Agrega al menos un producto a la venta");

  const hoy = hoyChile();

  const idsUnicos = [...new Set(items.map((i) => i.producto_id))];
  const { data: productosData } = await supabase
    .from("productos")
    .select("id, precio")
    .in("id", idsUnicos);
  const precioListaMap = new Map((productosData ?? []).map((p) => [p.id, Number(p.precio)]));

  const { data: pedido, error } = await supabase
    .from("pedidos")
    .insert({
      cliente_id: clienteId,
      vendedor_id: user?.id ?? null,
      fecha_pedido: hoy,
      fecha_entrega: hoy,
      notas,
      origen: "venta_directa",
      motivo_descuento: motivoDescuento,
    })
    .select("id")
    .single();

  if (error || !pedido) {
    throw new Error("No se pudo registrar la venta: " + error?.message);
  }

  const { error: itemsError } = await supabase.from("pedido_items").insert(
    items.map((i) => ({
      pedido_id: pedido.id,
      producto_id: i.producto_id,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      precio_lista: precioListaMap.get(i.producto_id) ?? i.precio_unitario,
    }))
  );

  if (itemsError) {
    throw new Error("No se pudieron guardar los productos: " + itemsError.message);
  }

  // Al marcar la venta como "entregado" se descuenta el stock automáticamente:
  // reutiliza el mismo trigger que usan los pedidos normales al confirmarse/entregarse.
  const { error: estadoError } = await supabase
    .from("pedidos")
    .update({
      estado: "entregado",
      pagado,
      fecha_pago: pagado ? hoy : null,
    })
    .eq("id", pedido.id);

  if (estadoError) {
    throw new Error(
      "La venta se guardó pero no se pudo descontar el stock: " + estadoError.message
    );
  }

  revalidatePath("/admin/ventas");
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/cobranzas");
  revalidatePath("/admin/productos");
  revalidatePath("/admin");
  redirect(`/admin/pedidos/${pedido.id}`);
}
