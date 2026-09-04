"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EstadoPedido } from "@/lib/supabase/types";

interface LineaPedido {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
}

export async function crearPedido(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const clienteId = String(formData.get("cliente_id"));
  const fechaEntrega = (formData.get("fecha_entrega") as string) || null;
  const notas = (formData.get("notas") as string) || null;
  const itemsRaw = String(formData.get("items") ?? "[]");
  const items: LineaPedido[] = JSON.parse(itemsRaw).filter(
    (i: LineaPedido) => i.producto_id && i.cantidad > 0
  );

  if (!clienteId) throw new Error("Debes seleccionar un cliente");
  if (items.length === 0) throw new Error("Agrega al menos un producto al pedido");

  const { data: pedido, error } = await supabase
    .from("pedidos")
    .insert({
      cliente_id: clienteId,
      vendedor_id: user?.id ?? null,
      fecha_entrega: fechaEntrega,
      notas,
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
    }))
  );

  revalidatePath("/admin/pedidos");
  redirect(`/admin/pedidos/${pedido.id}`);
}

export async function cambiarEstadoPedido(pedidoId: string, estado: EstadoPedido) {
  "use server";
  const supabase = await createClient();
  await supabase.from("pedidos").update({ estado }).eq("id", pedidoId);
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${pedidoId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/productos");
}
