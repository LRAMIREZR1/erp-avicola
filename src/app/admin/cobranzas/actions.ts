"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function marcarPagado(pedidoId: string, pagado: boolean) {
  "use server";
  const supabase = await createClient();

  await supabase
    .from("pedidos")
    .update({
      pagado,
      fecha_pago: pagado ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", pedidoId);

  revalidatePath("/admin/cobranzas");
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${pedidoId}`);
  revalidatePath("/admin");
}
