"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Borra un registro del historial de movimientos de stock. Esto solo borra
// el registro (la "foto" de lo que pasó) — no revierte el cambio de stock
// que ese movimiento ya aplicó en su momento. Si el número de stock actual
// también está mal, hay que corregirlo aparte con "Ajustar stock".
export async function eliminarMovimientoStock(id: string) {
  const supabase = await createClient();
  await supabase.from("movimientos_stock").delete().eq("id", id);
  revalidatePath("/admin/productos/movimientos");
}
