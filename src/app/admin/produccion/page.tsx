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

function haceDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString();
}

function haceDiasFecha(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

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
export default async function ProduccionPage() {
  await requireRol(["administrador", "encargado_bodega"]);
  const supabase = await createClient();
  const hoy = hoyChile();

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
      .gte("created_at", haceDias(13))
      .order("created_at", { ascending: false }),
    supabase
      .from("mermas_produccion")
      .select("fecha, cantidad")
      .gte("fecha", haceDiasFecha(13))
      .order("fecha", { ascending: false }),
    supabase
      .from("recoleccion_huevos")
      .select("fecha, cantidad")
      .gte("fecha", haceDiasFecha(13))
      .order("fecha", { ascending: false }),
    supabase.from("plantel_gallinas").select("cantidad_actual").eq("id", "principal").single(),
    supabase
      .from("mortandad_gallinas")
      .select("fecha, cantidad")
      .gte("fecha", haceDiasFecha(13))
      .order("fecha", { ascending: false }),
    supabase
      .from("plantel_gallinas_historico")
      .select("fecha, cantidad")
      .gte("fecha", haceDiasFecha(13)),
  ]);

  const totalPorDia = new Map<string, number>();
  // Cajas producidas por día, separadas por formato (120 vs 180), para el
  // gráfico de tendencia. Las bandejas no entran aquí — el gráfico es solo
  // de cajas, tal como se pidió.
  const cajasPorDia = new Map<string, { caja120: number; caja180: number }>();
  for (const m of movimientos ?? []) {
    const dia = diaChileDe(m.created_at);
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

  // Los últimos 14 días en orden cronológico (de más antiguo a más
  // reciente), con 0 en los días sin producción/recolección registrada —
  // así el gráfico muestra huecos reales (ej. domingos sin recolección) en
  // vez de saltárselos.
  const datosGraficoCajas: ProduccionCajasDatum[] = Array.from({ length: 14 }, (_, i) => {
    const fecha = sumarDias(hoy, -(13 - i));
    const valores = cajasPorDia.get(fecha) ?? { caja120: 0, caja180: 0 };
    return {
      fecha,
      etiqueta: etiquetaDiaCorta(fecha),
      caja120: valores.caja120,
      caja180: valores.caja180,
      // Total del día = recolectados + rotos (mismo cálculo que la tarjeta
      // "Total del día" y la columna de la tabla de abajo).
      totalHuevos: (huevosPorDia.get(fecha) ?? 0) + (mermaPorDia.get(fecha) ?? 0),
    };
  });

  const diasOrdenados = [
    ...new Set([...totalPorDia.keys(), ...mermaPorDia.keys(), ...huevosPorDia.keys()]),
  ].sort((a, b) => b.localeCompare(a));
  const totalHoy = totalPorDia.get(hoy) ?? 0;
  const mermaHoy = mermaPorDia.get(hoy) ?? 0;
  const huevosHoy = huevosPorDia.get(hoy) ?? 0;
  // Total de huevos manejados hoy (recolectados + rotos) — la vista general
  // del día, aparte de las cajas ya envasadas.
  const totalHuevosDiaHoy = huevosHoy + mermaHoy;
  const gallinasActivas = plantel?.cantidad_actual ?? 0;

  // Para cuántas gallinas había CADA día de los últimos 14, se usa primero
  // el snapshot real guardado en plantel_gallinas_historico. Si un día no
  // tiene snapshot (por ejemplo, días de antes de empezar a usar esta
  // tabla), se cae de respaldo a la reconstrucción de siempre: partiendo del
  // plantel actual y sumando de vuelta las mortandades desde ese día hasta
  // hoy (recorriendo de más reciente a más antiguo). Ese respaldo no
  // contempla ajustes manuales de plantel dentro de la ventana (compras,
  // correcciones) que no hayan quedado con snapshot propio.
  const gallinasPorDia = new Map<string, number>();
  let acumuladoMortandad = 0;
  for (let i = datosGraficoCajas.length - 1; i >= 0; i--) {
    const fecha = datosGraficoCajas[i].fecha;
    acumuladoMortandad += mortandadPorDia.get(fecha) ?? 0;
    gallinasPorDia.set(
      fecha,
      historicoPorDia.get(fecha) ?? gallinasActivas + acumuladoMortandad,
    );
  }
  const gallinasHoyInicioDeDia = gallinasPorDia.get(hoy) ?? gallinasActivas;

  // % de postura = huevos puestos hoy (recolectados + rotos) / gallinas que
  // había al comenzar el día — el indicador estándar del rubro. Sin plantel
  // cargado no se puede calcular.
  const porcentajePostura =
    gallinasHoyInicioDeDia > 0 ? (totalHuevosDiaHoy / gallinasHoyInicioDeDia) * 100 : null;

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Indicadores de producción</h1>
        <p className="text-sm text-stone-500">
          Gráficos y resumen de la operación diaria, para tomar decisiones
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label={`Producción de hoy (${formatFecha(hoy)})`}
          value={`${totalHoy} unidades`}
          hint="ya registradas hoy en el sistema"
        />
        <StatCard
          label="Huevos recolectados hoy"
          value={`${huevosHoy} unidades`}
          hint="total del día, antes de clasificar"
        />
        <StatCard
          label="Huevos rotos hoy"
          value={`${mermaHoy} unidades`}
          tone={mermaHoy > 0 ? "danger" : "default"}
          hint="no salen al mercado"
        />
        <StatCard
          label="Total del día"
          value={`${totalHuevosDiaHoy} unidades`}
          hint="recolectados + rotos"
        />
        <StatCard
          label="% de postura"
          value={porcentajePostura === null ? "—" : `${porcentajePostura.toFixed(1)}%`}
          hint={
            porcentajePostura === null
              ? "carga el plantel en Mortandad"
              : `${gallinasHoyInicioDeDia} gallinas activas`
          }
        />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-stone-700">
          Producción de cajas — últimos 14 días
        </p>
        <ProduccionCajasChart data={datosGraficoCajas} />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-stone-700">
          % de postura — últimos 14 días
        </p>
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
          <p className="text-sm font-medium text-stone-700">Últimos 14 días</p>
          <Link
            href="/admin/productos/movimientos"
            className="text-sm text-amber-700 hover:underline"
          >
            Ver detalle
          </Link>
        </div>
        {diasOrdenados.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-400">
            Aún no hay producción ni mermas registradas
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-stone-500">
                <th className="pb-2 font-medium">Día</th>
                <th className="pb-2 text-right font-medium">Total producido</th>
                <th className="pb-2 text-right font-medium">Huevos recolectados</th>
                <th className="pb-2 text-right font-medium">Huevos rotos</th>
                <th className="pb-2 text-right font-medium">Total del día</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {diasOrdenados.map((dia) => (
                <tr key={dia}>
                  <td className="py-2 text-stone-700">
                    {formatFecha(dia)}
                    {dia === hoy && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Hoy
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right font-semibold text-stone-800">
                    {totalPorDia.get(dia) ?? 0}
                  </td>
                  <td className="py-2 text-right font-semibold text-stone-800">
                    {huevosPorDia.get(dia) ?? 0}
                  </td>
                  <td className="py-2 text-right font-semibold text-red-600">
                    {mermaPorDia.get(dia) ?? 0}
                  </td>
                  <td className="py-2 text-right font-semibold text-stone-800">
                    {(huevosPorDia.get(dia) ?? 0) + (mermaPorDia.get(dia) ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
