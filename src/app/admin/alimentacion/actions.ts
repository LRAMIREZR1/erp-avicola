"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hoyChile } from "@/lib/format";
import { proyectarKilosHoy, type AlimentoStockRow } from "@/lib/alimentacion";

const STOCK_ID = "principal";

// Trae el checkpoint de stock vigente y las gallinas activas — lo que
// necesita cualquier acción para "asentar" la proyección de hoy antes de
// aplicar su propio cambio (ver src/lib/alimentacion.ts).
async function obtenerContexto(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [{ data: stock }, { data: plantel }] = await Promise.all([
    supabase
      .from("alimento_stock")
      .select("kilos_actual, checkpoint_fecha, gramos_por_gallina")
      .eq("id", STOCK_ID)
      .single(),
    supabase.from("plantel_gallinas").select("cantidad_actual").eq("id", "principal").single(),
  ]);

  const stockRow: AlimentoStockRow = stock ?? {
    kilos_actual: 0,
    checkpoint_fecha: hoyChile(),
    gramos_por_gallina: 0,
  };

  return { stock: stockRow, gallinasActivas: plantel?.cantidad_actual ?? 0 };
}

// Registrar la compra de alimento a un proveedor — asienta la proyección de
// hoy y le suma los kilos comprados.
export async function registrarCompraAlimento(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const kilos = Number(formData.get("kilos"));
  const proveedor = String(formData.get("proveedor") ?? "").trim();
  const costoTotalRaw = String(formData.get("costo_total") ?? "").trim();
  const costoTotal = costoTotalRaw ? Number(costoTotalRaw) : null;
  const notas = String(formData.get("notas") ?? "").trim();

  if (!kilos || kilos <= 0) {
    redirect("/admin/alimentacion");
  }

  const hoy = hoyChile();
  const { stock, gallinasActivas } = await obtenerContexto(supabase);
  const kilosHoy = proyectarKilosHoy(stock, gallinasActivas, hoy);
  const nuevoValor = kilosHoy + kilos;

  await Promise.all([
    supabase.from("alimento_compras").insert({
      fecha: hoy,
      proveedor: proveedor || null,
      kilos,
      costo_total: costoTotal,
      notas: notas || null,
      vendedor_id: user?.id ?? null,
    }),
    supabase
      .from("alimento_stock")
      .update({
        kilos_actual: nuevoValor,
        checkpoint_fecha: hoy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", STOCK_ID),
  ]);

  revalidatePath("/admin/alimentacion");
  revalidatePath("/admin");
  redirect("/admin/alimentacion?ok=1");
}

// Cambiar la tasa de consumo (gramos por gallina al día) — asienta primero
// la proyección de hoy CON LA TASA ANTERIOR, para que el cambio rija solo
// desde hoy en adelante.
export async function ajustarConsumoAlimento(formData: FormData) {
  const supabase = await createClient();
  const gramos = Number(formData.get("gramos_por_gallina"));

  if (gramos == null || Number.isNaN(gramos) || gramos < 0) {
    redirect("/admin/alimentacion");
  }

  const hoy = hoyChile();
  const { stock, gallinasActivas } = await obtenerContexto(supabase);
  const kilosHoy = proyectarKilosHoy(stock, gallinasActivas, hoy);

  await supabase
    .from("alimento_stock")
    .update({
      kilos_actual: kilosHoy,
      checkpoint_fecha: hoy,
      gramos_por_gallina: gramos,
      updated_at: new Date().toISOString(),
    })
    .eq("id", STOCK_ID);

  revalidatePath("/admin/alimentacion");
  revalidatePath("/admin");
  redirect("/admin/alimentacion?consumo=1");
}

// Ajuste manual del stock (delta, no valor absoluto) — para mermas,
// correcciones de conteo, etc. Mismo patrón que "Ajustar plantel" en
// Mortandad y "Ajustar stock" en Productos.
export async function ajustarStockAlimento(formData: FormData) {
  const supabase = await createClient();
  const delta = Number(formData.get("delta"));

  if (!delta) {
    redirect("/admin/alimentacion");
  }

  const hoy = hoyChile();
  const { stock, gallinasActivas } = await obtenerContexto(supabase);
  const kilosHoy = proyectarKilosHoy(stock, gallinasActivas, hoy);
  const nuevoValor = Math.max(0, kilosHoy + delta);

  await supabase
    .from("alimento_stock")
    .update({
      kilos_actual: nuevoValor,
      checkpoint_fecha: hoy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", STOCK_ID);

  revalidatePath("/admin/alimentacion");
  revalidatePath("/admin");
  redirect("/admin/alimentacion?ajuste=1");
}
