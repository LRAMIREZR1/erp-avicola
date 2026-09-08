"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Motivo fijo que usan los registros de producción diaria dentro de
// movimientos_stock. Sirve para poder filtrarlos y distinguirlos de otras
// entradas (compras, correcciones manuales, etc). Repetido en page.tsx: un
// archivo "use server" solo puede exportar funciones async.
const MOTIVO_PRODUCCION = "Producción diaria";

export async function registrarProduccion(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const entradas: { productoId: string; cantidad: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("cantidad_")) continue;
    const cantidad = Number(value);
    if (!cantidad || cantidad <= 0) continue;
    entradas.push({ productoId: key.replace("cantidad_", ""), cantidad });
  }

  if (entradas.length === 0) {
    redirect("/admin/produccion");
  }

  await Promise.all(
    entradas.map(async ({ productoId, cantidad }) => {
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
        tipo: "entrada",
        cantidad,
        motivo: MOTIVO_PRODUCCION,
        vendedor_id: user?.id ?? null,
      });
    })
  );

  revalidatePath("/admin/produccion");
  revalidatePath("/admin/productos");
  revalidatePath("/admin/productos/movimientos");
  revalidatePath("/admin");
  redirect("/admin/produccion?ok=1");
}
