"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hoyChile } from "@/lib/format";
import { proyectarKilosHoy, type AlimentoStockRow } from "@/lib/alimentacion";

const STOCK_ID = "principal";

// Asienta en la base de datos las compras "pendientes" (registradas con
// fecha futura) que ya maduraron — es decir, cuya fecha ya llegó —
// sumándolas al checkpoint del stock en orden de fecha y marcándolas como
// aplicadas. Se llama al principio de cualquier acción que vaya a tocar el
// stock, para que nunca quede una compra madura sin reflejar. El mismo
// cálculo corre también en modo solo-lectura (sin escribir) en la página
// (proyectarConPendientes, en src/lib/alimentacion.ts), y persistiendo
// igual que acá en el script diario de GitHub Actions — así el checkpoint
// no queda atrasado aunque nadie abra el sistema justo ese día.
async function asentarCompraPendientes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stock: AlimentoStockRow,
  gallinasActivas: number,
  hoy: string
): Promise<AlimentoStockRow> {
  const { data: pendientes } = await supabase
    .from("alimento_compras")
    .select("id, fecha, kilos")
    .eq("aplicado", false)
    .lte("fecha", hoy)
    .order("fecha", { ascending: true });

  if (!pendientes || pendientes.length === 0) return stock;

  let actual = stock;
  for (const c of pendientes) {
    const kilosEnFecha = proyectarKilosHoy(actual, gallinasActivas, c.fecha) + Number(c.kilos);
    actual = {
      kilos_actual: kilosEnFecha,
      checkpoint_fecha: c.fecha,
      gramos_por_gallina: actual.gramos_por_gallina,
    };
  }

  await Promise.all([
    supabase
      .from("alimento_stock")
      .update({
        kilos_actual: actual.kilos_actual,
        checkpoint_fecha: actual.checkpoint_fecha,
        updated_at: new Date().toISOString(),
      })
      .eq("id", STOCK_ID),
    supabase
      .from("alimento_compras")
      .update({ aplicado: true })
      .in(
        "id",
        pendientes.map((p) => p.id)
      ),
  ]);

  return actual;
}

// Trae el checkpoint de stock vigente y las gallinas activas, ya con
// cualquier compra pendiente madura asentada — lo que necesita cualquier
// acción para asentar su propia proyección de hoy antes de aplicar su
// propio cambio (ver src/lib/alimentacion.ts).
async function obtenerContexto(supabase: Awaited<ReturnType<typeof createClient>>, hoy: string) {
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
    checkpoint_fecha: hoy,
    gramos_por_gallina: 0,
  };
  const gallinasActivas = plantel?.cantidad_actual ?? 0;

  const stockAlDia = await asentarCompraPendientes(supabase, stockRow, gallinasActivas, hoy);

  return { stock: stockAlDia, gallinasActivas };
}

// Registrar la compra de alimento a un proveedor. La fecha es editable —
// pensada para compras que se anotan un día distinto al que ocurren (ej: se
// registra hoy pero el alimento llega mañana). Si la fecha es hoy o
// anterior, se suma al stock de inmediato (ahí la fecha queda solo como
// dato del registro). Si es una fecha futura, la compra queda "pendiente" y
// no se resta del cálculo de días restantes hasta que esa fecha llegue.
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
  const hoy = hoyChile();
  const fechaInput = String(formData.get("fecha") ?? "").trim();
  const fecha = fechaInput || hoy;

  if (!kilos || kilos <= 0) {
    redirect("/admin/alimentacion");
  }

  const { stock, gallinasActivas } = await obtenerContexto(supabase, hoy);

  if (fecha <= hoy) {
    // Hoy o una fecha pasada: se suma al stock ahora mismo.
    const kilosHoy = proyectarKilosHoy(stock, gallinasActivas, hoy);
    const nuevoValor = kilosHoy + kilos;

    await Promise.all([
      supabase.from("alimento_compras").insert({
        fecha,
        proveedor: proveedor || null,
        kilos,
        costo_total: costoTotal,
        notas: notas || null,
        vendedor_id: user?.id ?? null,
        aplicado: true,
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
  } else {
    // Fecha futura: queda registrada pero no se toca el stock todavía —
    // se aplica sola apenas llegue esa fecha (ver asentarCompraPendientes).
    await supabase.from("alimento_compras").insert({
      fecha,
      proveedor: proveedor || null,
      kilos,
      costo_total: costoTotal,
      notas: notas || null,
      vendedor_id: user?.id ?? null,
      aplicado: false,
    });
  }

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
  const { stock, gallinasActivas } = await obtenerContexto(supabase, hoy);
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
  const { stock, gallinasActivas } = await obtenerContexto(supabase, hoy);
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
