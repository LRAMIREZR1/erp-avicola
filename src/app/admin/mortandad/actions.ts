"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hoyChile } from "@/lib/format";

export async function registrarMortandad(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cantidad = Number(formData.get("cantidad"));
  const causa = String(formData.get("causa") ?? "").trim();

  if (!cantidad || cantidad <= 0) {
    redirect("/admin/mortandad");
  }

  const { data: plantel } = await supabase
    .from("plantel_gallinas")
    .select("cantidad_actual")
    .eq("id", "principal")
    .single();

  // Nunca baja de 0, por si se registra más mortandad de la que
  // efectivamente había en el plantel (error de digitación).
  const nuevoValor = Math.max(0, (plantel?.cantidad_actual ?? 0) - cantidad);
  const hoy = hoyChile();

  await Promise.all([
    supabase.from("mortandad_gallinas").insert({
      fecha: hoy,
      cantidad,
      causa: causa || null,
      vendedor_id: user?.id ?? null,
    }),
    supabase
      .from("plantel_gallinas")
      .update({
        cantidad_actual: nuevoValor,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "principal"),
    // Deja registrado el valor del plantel para HOY — así el % de postura
    // histórico usa el número real de ese día en vez de tener que
    // reconstruirlo a partir de la mortandad cada vez que se muestra.
    supabase
      .from("plantel_gallinas_historico")
      .upsert({ fecha: hoy, cantidad: nuevoValor }, { onConflict: "fecha" }),
  ]);

  revalidatePath("/admin/mortandad");
  revalidatePath("/admin");
  revalidatePath("/admin/produccion");
  redirect("/admin/mortandad?ok=1");
}

// Ajuste manual del plantel (delta, no valor absoluto) — para compras de
// gallinas nuevas o correcciones de conteo. Mismo patrón que "Ajustar stock"
// en Productos y stock.
export async function ajustarPlantel(formData: FormData) {
  const supabase = await createClient();
  const delta = Number(formData.get("delta"));

  if (!delta) {
    redirect("/admin/mortandad");
  }

  const { data: plantel } = await supabase
    .from("plantel_gallinas")
    .select("cantidad_actual")
    .eq("id", "principal")
    .single();

  const nuevoValor = Math.max(0, (plantel?.cantidad_actual ?? 0) + delta);
  const hoy = hoyChile();

  await Promise.all([
    supabase
      .from("plantel_gallinas")
      .update({
        cantidad_actual: nuevoValor,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "principal"),
    // Mismo motivo que en registrarMortandad: deja el valor de hoy anotado
    // en el histórico para que el % de postura de días pasados no dependa
    // de reconstruir el plantel cada vez.
    supabase
      .from("plantel_gallinas_historico")
      .upsert({ fecha: hoy, cantidad: nuevoValor }, { onConflict: "fecha" }),
  ]);

  revalidatePath("/admin/mortandad");
  revalidatePath("/admin");
  revalidatePath("/admin/produccion");
  redirect("/admin/mortandad?ajuste=1");
}
