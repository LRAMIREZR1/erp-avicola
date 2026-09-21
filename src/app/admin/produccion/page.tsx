import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { diaChileDe, formatFecha, hoyChile, sumarDias } from "@/lib/format";
import { requireRol } from "@/lib/roles";
import StatCard from "@/components/StatCard";
import ProduccionCajasChart, {
  type ProduccionCajasDatum,
} from "@/components/ProduccionCajasChart";
import PosturaChart, { type PosturaDatum } from "@/components/PosturaChart";
import type { Formato } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// Debe coincidir con el motivo usado en actions.ts.
const MOTIVO_PRODUCCION = "Producción diaria";

// Etiqueta corta para el eje del gráfico ("lun 8"). fecha ya viene en hora
// Chile (YYYY-MM-DD), así que se formatea en UTC para no volver a
// desplazarla por la zona horaria del servidor.
function etiquetaDiaCorta(fecha: string) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${fecha}T00:00:00Z`));
}

// Página puramente informativa: indicadores y gráficos para tomar
// decisiones sobre la operación. El ingreso manual de datos vive aparte, en
// /admin/produccion/registrar, para no mezclar "mirar" con "cargar".
export default async function ProduccionPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  await requireRol(["administrador", "encargado_bodega"]);
  const supabase = await createClient();
  const hoy = hoyChile();
  const params = await searchParams;
  // Día que se está consultando: por defecto hoy, pero se puede elegir uno
  // anterior desde el calendario. Nunca se permite elegir un día futuro (no
  // hay datos que mostrar), así que si igual llega uno por la URL se ignora.
  const fecha = params.fecha && params.fecha <= hoy ? params.fecha : hoy;

  // Ventana de 14 días que termina en el día consultado (no necesariamente
  // hoy). Para reconstruir el plantel histórico (más abajo) se necesita
  // además llegar siempre hasta hoy, porque el plantel actual es el único
  // dato "ancla" que se tiene.
  const inicioVentana = sumarDias(fecha, -13);
  const inicioReconstruccionPlantel = inicioVentana <= hoy ? inicioVentana : hoy;

  const [
    { data: movimientos },
    { data: mermasData },
    { data: huevosData },
    { data: plantel },
    { data: mortandadData },
    { data: historicoData },
  ] = await Promise.all([
    supabase
      .from("movimientos_stock")
      .select("cantidad, created_at, productos(formato)")
      .eq("motivo", MOTIVO_PRODUCCION)
      // Un día extra de margen por la diferencia de huso horario entre el
      // timestamp (UTC) y el día calendario de Chile; se filtra al día
      // exacto más abajo con diaChileDe().
      .gte("created_at", `${sumarDias(inicioVentana, -1)}T00:00:00Z`),
    // Se trae un día extra (14 en vez de 13) de mermas y recolección para
    // poder calcular la columna "Diferencia día anterior" del día más
    // antiguo que se muestra en la tabla, sin que ese día extra aparezca
    // como fila (eso se filtra más abajo).
    supabase
      .from("mermas_produccion")
      .select("fecha, cantidad")
      .gte("fecha", sumarDias(inicioVentana, -1))
      .lte("fecha", fecha)
      .order("fecha", { ascending: false }),
    supabase
      .from("recoleccion_huevos")
      .select("fecha, cantidad")
      .gte("fecha", sumarDias(inicioVentana, -1))
      .lte("fecha", fecha)
      .order("fecha", { ascending: false }),
    supabase.from("plantel_gallinas").select("cantidad_actual").eq("id", "principal").single(),
    // Rango más amplio que la ventana de 14 días: siempre llega hasta hoy,
    // porque la reconstrucción del plantel histórico parte del plantel
    // actual y va restando mortandad hacia atrás.
    supabase
      .from("mortandad_gallinas")
      .select("fecha, cantidad")
      .gte("fecha", inicioReconstruccionPlantel)
      .lte("fecha", hoy)
      .order("fecha", { ascending: false }),
    supabase
      .from("plantel_gallinas_historico")
      .select("fecha, cantidad")
      .gte("fecha", inicioReconstruccionPlantel)
      .lte("fecha", hoy),
  ]);

  const totalPorDia = new Map<string, number>();
  // Cajas producidas por día, separadas por formato (120 vs 180), para el
  // gráfico de tendencia. Las bandejas no entran aquí — el gráfico es solo
  // de cajas, tal como se pidió.
  const cajasPorDia = new Map<string, { caja120: number; caja180: number }>();
  for (const m of movimientos ?? []) {
    const dia = diaChileDe(m.created_at);
    if (dia > fecha) continue; // fuera del día consultado (o posterior)

    totalPorDia.set(dia, (totalPorDia.get(dia) ?? 0) + m.cantidad);

    const formato = (m as unknown as { productos: { formato: Formato } | null }).productos
      ?.formato;
    if (formato === "caja_120" || formato === "caja_180") {
      const actual = cajasPorDia.get(dia) ?? { caja120: 0, caja180: 0 };
      if (formato === "caja_120") actual.caja120 += m.cantidad;
      else actual.caja180 += m.cantidad;
      cajasPorDia.set(dia, actual);
    }
  }

  const mermaPorDia = new Map<string, number>();
  for (const m of mermasData ?? []) {
    mermaPorDia.set(m.fecha, (mermaPorDia.get(m.fecha) ?? 0) + m.cantidad);
  }

  const huevosPorDia = new Map<string, number>();
  for (const h of huevosData ?? []) {
    huevosPorDia.set(h.fecha, (huevosPorDia.get(h.fecha) ?? 0) + h.cantidad);
  }

  const mortandadPorDia = new Map<string, number>();
  for (const m of mortandadData ?? []) {
    mortandadPorDia.set(m.fecha, (mortandadPorDia.get(m.fecha) ?? 0) + m.cantidad);
  }

  // Snapshot real del plantel guardado día a día (queda registrado solo al
  // registrar mortandad, un ajuste de plantel, o la producción del día — ver
  // actions.ts). Es el valor autoritativo cuando existe; los días sin
  // snapshot (por ejemplo, antes de empezar a usar esta tabla) se rellenan
  // más abajo con la reconstrucción a partir de la mortandad, como respaldo.
  const historicoPorDia = new Map<string, number>();
  for (const h of historicoData ?? []) {
    historicoPorDia.set(h.fecha, h.cantidad);
  }

  const gallinasActivas = plantel?.cantidad_actual ?? 0;

  // Para cuántas gallinas había cada día, se usa primero el snapshot real
  // guardado en plantel_gallinas_historico. Si un día no tiene snapshot, se
  // cae de respaldo a la reconstrucción de siempre: partiendo del plantel
  // actual (hoy) y sumando de vuelta las mortandades desde ese día hasta hoy
  // (recorriendo de más reciente a más antiguo). Se reconstruye siempre
  // ancladO en hoy — no en el día consultado — porque el plantel actual es
  // el único valor que se conoce con certeza. Ese respaldo no contempla
  // ajustes manuales de plantel dentro del rango (compras, correcciones) que
  // no hayan quedado con snapshot propio.
  const gallinasPorDia = new Map<string, number>();
  let acumuladoMortandad = 0;
  let cursor = hoy;
  while (cursor >= inicioReconstruccionPlantel) {
    acumuladoMortandad += mortandadPorDia.get(cursor) ?? 0;
    gallinasPorDia.set(cursor, historicoPorDia.get(cursor) ?? gallinasActivas + acumuladoMortandad);
    cursor = sumarDias(cursor, -1);
  }

  // Los 14 días de la ventana consultada, en orden cronológico (de más
  // antiguo a más reciente), con 0 en los días sin producción/recolección
  // registrada — así el gráfico muestra huecos reales (ej. domingos sin
  // recolección) en vez de saltárselos.
  const datosGraficoCajas: ProduccionCajasDatum[] = Array.from({ length: 14 }, (_, i) => {
    const diaVentana = sumarDias(fecha, -(13 - i));
    const valores = cajasPorDia.get(diaVentana) ?? { caja120: 0, caja180: 0 };
    return {
      fecha: diaVentana,
      etiqueta: etiquetaDiaCorta(diaVentana),
      caja120: valores.caja120,
      caja180: valores.caja180,
      // Total del día = recolectados + rotos (mismo cálculo que la tarjeta
      // "Total del día" y la columna de la tabla de abajo).
      totalHuevos: (huevosPorDia.get(diaVentana) ?? 0) + (mermaPorDia.get(diaVentana) ?? 0),
    };
  });

  // Total del día (recolectados + rotos) para una fecha cualquiera — se usa
  // tanto en la columna "Total del día" de la tabla como para calcular la
  // diferencia contra el día anterior.
  function totalDelDiaFn(diaConsultado: string) {
    return (huevosPorDia.get(diaConsultado) ?? 0) + (mermaPorDia.get(diaConsultado) ?? 0);
  }

  // Solo se muestran los 14 días de la ventana consultada como filas.
  const diasOrdenados = [
    ...new Set([...totalPorDia.keys(), ...mermaPorDia.keys(), ...huevosPorDia.keys()]),
  ]
    .filter((d) => d >= inicioVentana && d <= fecha)
    .sort((a, b) => b.localeCompare(a));

  const totalDia = totalPorDia.get(fecha) ?? 0;
  const mermaDia = mermaPorDia.get(fecha) ?? 0;
  const huevosDia = huevosPorDia.get(fecha) ?? 0;
  // Total de huevos manejados el día consultado (recolectados + rotos) — la
  // vista general del día, aparte de las cajas ya envasadas.
  const totalHuevosDia = huevosDia + mermaDia;
  const gallinasInicioDeDia = gallinasPorDia.get(fecha) ?? gallinasActivas;

  // % de postura = huevos puestos ese día (recolectados + rotos) / gallinas
  // que había al comenzar el día — el indicador estándar del rubro. Sin
  // plantel cargado no se puede calcular.
  const porcentajePostura =
    gallinasInicioDeDia > 0 ? (totalHuevosDia / gallinasInicioDeDia) * 100 : null;

  // Mismo cálculo día a día para el gráfico de tendencia, usando el plantel
  // reconstruido de cada día en vez del valor actual fijo.
  const datosPostura: PosturaDatum[] = datosGraficoCajas.map((d) => {
    const gallinasEseDia = gallinasPorDia.get(d.fecha) ?? 0;
    return {
      fecha: d.fecha,
      etiqueta: d.etiqueta,
      porcentaje: gallinasEseDia > 0 ? (d.totalHuevos / gallinasEseDia) * 100 : 0,
    };
  });

  const rangoVentana = `${formatFecha(inicioVentana)} a ${formatFecha(fecha)}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Indicadores de producción</h1>
        <p className="text-sm text-stone-500">
          Gráficos y resumen de la operación diaria, para tomar decisiones
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">
            Ver indicadores del día
          </label>
          <input
            type="date"
            name="fecha"
            defaultValue={fecha}
            max={hoy}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900"
        >
          Ver
        </button>
        {fecha !== hoy && (
          <Link
            href="/admin/produccion"
            className="rounded-lg px-3 py-2 text-sm font-medium text-amber-700 hover:underline"
          >
            Volver a hoy
          </Link>
        )}
      </form>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label={
            fecha === hoy ? `Producción de hoy (${formatFecha(hoy)})` : `Producción del ${formatFecha(fecha)}`
          }
          value={`${totalDia}`}
          hint="ya registradas en el sistema"
        />
        <StatCard
          label="Huevos recolectados"
          value={`${huevosDia}`}
          hint="total del día, antes de clasificar"
        />
        <StatCard
          label="Huevos rotos"
          value={`${mermaDia}`}
          tone={mermaDia > 0 ? "danger" : "default"}
          hint="no salen al mercado"
        />
        <StatCard
          label="Total del día"
          value={`${totalHuevosDia}`}
          hint="recolectados + rotos"
        />
        <StatCard
          label="% de postura"
          value={porcentajePostura === null ? "—" : `${porcentajePostura.toFixed(1)}%`}
          hint={
            porcentajePostura === null
              ? "carga el plantel en Mortandad"
              : `${gallinasInicioDeDia} gallinas al iniciar el día`
          }
        />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-stone-700">
          Producción de cajas — {rangoVentana}
        </p>
        <ProduccionCajasChart data={datosGraficoCajas} />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-stone-700">% de postura — {rangoVentana}</p>
        {gallinasActivas > 0 ? (
          <PosturaChart data={datosPostura} />
        ) : (
          <p className="py-4 text-center text-sm text-stone-400">
            Carga el plantel de gallinas en{" "}
            <Link href="/admin/mortandad" className="text-amber-700 hover:underline">
              Mortandad
            </Link>{" "}
            para ver este gráfico
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-stone-700">{rangoVentana}</p>
          <Link
            href="/admin/productos/movimientos"
            className="text-sm text-amber-700 hover:underline"
          >
            Ver detalle
          </Link>
        </div>
        {diasOrdenados.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-400">
            No hay producción ni mermas registradas en este rango
          </p>
        ) : (
          // overflow-x-auto + min-w en la tabla: en el celular la tabla no
          // entra completa en el ancho de la pantalla, así que en vez de
          // apretujar las columnas (y que los títulos se corten en varias
          // líneas), se puede deslizar el dedo hacia los lados para verla
          // completa.
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-stone-500">
                  <th className="whitespace-nowrap py-2 pr-3 font-medium">Día</th>
                  <th className="whitespace-nowrap py-2 px-3 text-right font-medium">
                    Total producido
                  </th>
                  <th className="whitespace-nowrap py-2 px-3 text-right font-medium">
                    Huevos recolectados
                  </th>
                  <th className="whitespace-nowrap py-2 px-3 text-right font-medium">
                    Huevos rotos
                  </th>
                  <th className="whitespace-nowrap py-2 px-3 text-right font-medium">
                    Total del día
                  </th>
                  <th className="whitespace-nowrap py-2 px-3 text-right font-medium">
                    % de postura
                  </th>
                  <th className="whitespace-nowrap py-2 px-3 text-right font-medium">
                    Diferencia día anterior
                  </th>
                  <th className="whitespace-nowrap py-2 pl-3 text-right font-medium">
                    Diferencia %
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {diasOrdenados.map((dia) => {
                  const totalDelDia = totalDelDiaFn(dia);
                  const diaAnterior = sumarDias(dia, -1);
                  const totalAnterior = totalDelDiaFn(diaAnterior);
                  const diferencia = totalDelDia - totalAnterior;
                  // Si el día anterior no tuvo producción (0), el % de
                  // cambio no se puede calcular (dividir por 0) — se
                  // muestra "—" en vez de un número engañoso.
                  const diferenciaPct = totalAnterior > 0 ? (diferencia / totalAnterior) * 100 : null;
                  const gallinasEseDia = gallinasPorDia.get(dia) ?? 0;
                  const posturaDia = gallinasEseDia > 0 ? (totalDelDia / gallinasEseDia) * 100 : null;
                  return (
                    <tr key={dia}>
                      <td className="whitespace-nowrap py-2 pr-3 text-stone-700">
                        {formatFecha(dia)}
                        {dia === hoy && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Hoy
                          </span>
                        )}
                        {dia === fecha && dia !== hoy && (
                          <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600">
                            Seleccionado
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2 px-3 text-right font-semibold text-stone-800">
                        {totalPorDia.get(dia) ?? 0}
                      </td>
                      <td className="whitespace-nowrap py-2 px-3 text-right font-semibold text-stone-800">
                        {huevosPorDia.get(dia) ?? 0}
                      </td>
                      <td className="whitespace-nowrap py-2 px-3 text-right font-semibold text-red-600">
                        {mermaPorDia.get(dia) ?? 0}
                      </td>
                      <td className="whitespace-nowrap py-2 px-3 text-right font-semibold text-stone-800">
                        {totalDelDia}
                      </td>
                      <td className="whitespace-nowrap py-2 px-3 text-right font-semibold text-stone-800">
                        {posturaDia === null ? "—" : `${posturaDia.toFixed(1)}%`}
                      </td>
                      <td
                        className={`whitespace-nowrap py-2 px-3 text-right font-semibold ${
                          diferencia > 0
                            ? "text-green-600"
                            : diferencia < 0
                              ? "text-red-600"
                              : "text-stone-400"
                        }`}
                      >
                        {diferencia > 0 ? `+${diferencia}` : diferencia}
                      </td>
                      <td
                        className={`whitespace-nowrap py-2 pl-3 text-right font-semibold ${
                          diferenciaPct === null
                            ? "text-stone-400"
                            : diferenciaPct > 0
                              ? "text-green-600"
                              : diferenciaPct < 0
                                ? "text-red-600"
                                : "text-stone-400"
                        }`}
                      >
                        {diferenciaPct === null
                          ? "—"
                          : `${diferenciaPct > 0 ? "+" : ""}${diferenciaPct.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
