"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hoyChile } from "@/lib/format";
import { obtenerRolActual } from "@/lib/roles";

// YYYY-MM-DD estricto, para no aceptar cualquier texto como fecha.
const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

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

  // Producción envasada (bandejas/cajas): cada input viene como
  // "cantidad_<productoId>" y sí suma al stock de ese producto.
  const entradasStock: { productoId: string; cantidad: number }[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("cantidad_")) continue;
    const cantidad = Number(value);
    if (!cantidad || cantidad <= 0) continue;
    entradasStock.push({ productoId: key.replace("cantidad_", ""), cantidad });
  }

  // Total de huevos recolectados en el día (antes de clasificar por
  // tamaño), solo como referencia — no está envasado, así que tampoco hay
  // producto/stock que descontar ni sumar.
  const totalHuevos = Number(formData.get("total_huevos") ?? 0);

  // Huevos rotos en la recolección: se dejan aparte sin clasificar por
  // tamaño, solo se cuenta el total del día. No están envasados, así que no
  // hay producto/stock que descontar.
  const merma = Number(formData.get("merma") ?? 0);

  if (
    entradasStock.length === 0 &&
    (!totalHuevos || totalHuevos <= 0) &&
    (!merma || merma <= 0)
  ) {
    redirect("/admin/produccion/registrar");
  }

  const hoy = hoyChile();

  // Solo un administrador puede elegir una fecha distinta a hoy (por
  // ejemplo, para cargar producción de un día anterior que no se alcanzó a
  // registrar en su momento). Cualquier otro rol, o una fecha inválida/vacía
  // o futura, siempre cae en "hoy" — mismo comportamiento de antes.
  const rol = await obtenerRolActual();
  const fechaSolicitada = String(formData.get("fecha") ?? "");
  const fechaProduccion =
    rol === "administrador" &&
    FECHA_VALIDA.test(fechaSolicitada) &&
    fechaSolicitada <= hoy
      ? fechaSolicitada
      : hoy;
  const esHoy = fechaProduccion === hoy;

  // Los movimientos de stock se agrupan por día a partir de su created_at
  // (ver diaChileDe en lib/format). Si se está cargando producción de hoy,
  // se deja que la base de datos use su default (now()) para no perder la
  // hora real. Si se está registrando un día anterior, se fija el
  // created_at a media mañana (hora Chile, cubriendo tanto UTC-3 como
  // UTC-4) de esa fecha, para que quede agrupado en el día correcto.
  const createdAtProduccion = esHoy ? undefined : `${fechaProduccion}T15:00:00.000Z`;

  // El plantel de gallinas se guarda en plantel_gallinas (una sola fila con
  // el valor vigente) y ese valor ya lo mantiene al día en tiempo real
  // registrarMortandad/ajustarPlantel. Al registrar la producción de hoy,
  // dejamos un snapshot de HOY en plantel_gallinas_historico con ese mismo
  // valor — que, por definición, es "la cantidad de gallinas activas al
  // cierre de ayer" si es que hoy todavía no hubo ninguna mortandad. Se usa
  // ignoreDuplicates para no pisar un snapshot que ya haya quedado más
  // temprano en el día (por ejemplo si ya se registró mortandad de hoy antes
  // de cargar la producción). Si se está cargando un día ANTERIOR, este
  // snapshot se omite a propósito: el plantel actual ya no representa cuántas
  // gallinas había ese día pasado, así que guardarlo ahí sería incorrecto.
  const { data: plantel } = await supabase
    .from("plantel_gallinas")
    .select("cantidad_actual")
    .eq("id", "principal")
    .single();

  await Promise.all([
    ...(esHoy
      ? [
          supabase
            .from("plantel_gallinas_historico")
            .upsert(
              { fecha: hoy, cantidad: plantel?.cantidad_actual ?? 0 },
              { onConflict: "fecha", ignoreDuplicates: true },
            ),
        ]
      : []),
    ...entradasStock.map(async ({ productoId, cantidad }) => {
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
        ...(createdAtProduccion ? { created_at: createdAtProduccion } : {}),
      });
    }),
    ...(totalHuevos > 0
      ? [
          supabase.from("recoleccion_huevos").insert({
            fecha: fechaProduccion,
            cantidad: totalHuevos,
            vendedor_id: user?.id ?? null,
          }),
        ]
      : []),
    ...(merma > 0
      ? [
          supabase.from("mermas_produccion").insert({
            fecha: fechaProduccion,
            cantidad: merma,
            vendedor_id: user?.id ?? null,
          }),
        ]
      : []),
  ]);

  revalidatePath("/admin/produccion");
  revalidatePath("/admin/produccion/registrar");
  revalidatePath("/admin/productos");
  revalidatePath("/admin/productos/movimientos");
  revalidatePath("/admin");
  redirect("/admin/produccion/registrar?ok=1");
}
