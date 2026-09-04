"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Categoria, Formato } from "@/lib/supabase/types";

export async function guardarProducto(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id") as string | null;
  const payload = {
    nombre: String(formData.get("nombre") ?? "").trim(),
    categoria: formData.get("categoria") as Categoria,
    formato: formData.get("formato") as Formato,
    precio: Number(formData.get("precio") ?? 0),
    stock_minimo: Number(formData.get("stock_minimo") ?? 0),
  };

  if (!payload.nombre) {
    throw new Error("El nombre del producto es obligatorio");
  }

  if (id) {
    await supabase.from("productos").update(payload).eq("id", id);
  } else {
    await supabase.from("productos").insert({ ...payload, stock_actual: 0 });
  }

  revalidatePath("/admin/productos");
  redirect("/admin/productos");
}

export async function ajustarStock(formData: FormData) {
  const supabase = await createClient();
  const productoId = String(formData.get("producto_id"));
  const cantidad = Number(formData.get("cantidad"));
  const motivo = String(formData.get("motivo") ?? "Ajuste manual");

  if (!productoId || !cantidad) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: producto } = await supabase
    .from("productos")
    .select("stock_actual")
    .eq("id", productoId)
    .single();

  if (!producto) return;

  await supabase
    .from("productos")
    .update({ stock_actual: producto.stock_actual + cantidad })
    .eq("id", productoId);

  await supabase.from("movimientos_stock").insert({
    producto_id: productoId,
    tipo: cantidad > 0 ? "entrada" : "ajuste",
    cantidad,
    motivo,
    vendedor_id: user?.id ?? null,
  });

  revalidatePath("/admin/productos");
}

export async function desactivarProducto(id: string) {
  "use server";
  const supabase = await createClient();
  await supabase.from("productos").update({ activo: false }).eq("id", id);
  revalidatePath("/admin/productos");
}
