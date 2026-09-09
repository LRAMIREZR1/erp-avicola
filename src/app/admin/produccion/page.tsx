import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { diaChileDe, formatFecha, hoyChile, sumarDias } from "@/lib/format";
import { requireRol } from "@/lib/roles";
import { registrarProduccion } from "@/app/admin/produccion/actions";
import StatCard from "@/components/StatCard";
import ProduccionCajasChart, {
  type ProduccionCajasDatum,
} from "@/components/ProduccionCajasChart";
import {
  NOMBRES_CATEGORIA,
  NOMBRES_FORMATO,
  type Categoria,
  type Formato,
  type Producto,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// Orden por tamaño del huevo, de mayor a menor — no alfabético.
const ORDEN_CATEGORIA: Record<Categoria, number> = {
  super_extra: 0,
  extra: 1,
  primera: 2,
  segunda: 3,
  tercera: 4,
};

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

function TablaProduccion({
  productos,
  mostrarFormato,
}: {
  productos: Producto[];
  mostrarFormato: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-stone-200 text-xs font-semibold uppercase tracking-wide text-stone-600">
          <tr>
            <th className="min-w-56 px-4 py-3">Producto</th>
            <th className="min-w-36 px-4 py-3">Categoría</th>
            {mostrarFormato && <th className="min-w-32 px-4 py-3">Formato</th>}
            <th className="min-w-28 px-4 py-3">Stock actual</th>
            <th className="min-w-40 px-4 py-3">Producido hoy</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {productos.map((p) => (
            <tr key={p.id} className="hover:bg-stone-50">
              <td className="px-4 py-3 font-medium text-stone-800">{p.nombre}</td>
              <td className="px-4 py-3 text-stone-600">
                {NOMBRES_CATEGORIA[p.categoria as Categoria]}
              </td>
              {mostrarFormato && (
                <td className="px-4 py-3 text-stone-600">
                  {NOMBRES_FORMATO[p.formato as Formato]}
                </td>
              )}
              <td className="px-4 py-3 text-stone-600">{p.stock_actual}</td>
              <td className="px-4 py-3">
                <input
                  type="number"
                  name={`cantidad_${p.id}`}
                  min={0}
                  placeholder="0"
                  className="w-28 rounded-lg border border-stone-300 px-2 py-1 text-sm focus:border-amber-600 focus:outline-none"
                />
              </td>
            </tr>
          ))}
          {productos.length === 0 && (
            <tr>
              <td
                colSpan={4 + (mostrarFormato ? 1 : 0)}
                className="px-4 py-8 text-center text-stone-400"
              >
                Aún no hay productos en esta sección
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default async function ProduccionPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  await requireRol(["administrador", "encargado_bodega"]);
  const { ok } = await searchParams;
  const supabase = await createClient();
  const hoy = hoyChile();

  const [{ data: productos }, { data: movimientos }, { data: mermasData }, { data: huevosData }] =
    await Promise.all([
      supabase.from("productos").select("*").eq("activo", true),
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
    ]);

  const todos = [...(productos ?? [])].sort((a, b) => {
    const diff =
      ORDEN_CATEGORIA[a.categoria as Categoria] - ORDEN_CATEGORIA[b.categoria as Categoria];
    if (diff !== 0) return diff;
    return a.nombre.localeCompare(b.nombre);
  });
  const bandejas = todos.filter((p) => p.formato === "bandeja_30");
  const cajas = todos.filter((p) => p.formato !== "bandeja_30");

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
      totalHuevos: huevosPorDia.get(fecha) ?? 0,
    };
  });

  const diasOrdenados = [
    ...new Set([...totalPorDia.keys(), ...mermaPorDia.keys(), ...huevosPorDia.keys()]),
  ].sort((a, b) => b.localeCompare(a));
  const totalHoy = totalPorDia.get(hoy) ?? 0;
  const mermaHoy = mermaPorDia.get(hoy) ?? 0;
  const huevosHoy = huevosPorDia.get(hoy) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-stone-800">Producción diaria</h1>
          <p className="text-sm text-stone-500">
            Registra cuántas unidades se recolectaron/clasificaron hoy — el stock se suma
            automáticamente
          </p>
        </div>
        <Link
          href="/admin/productos/movimientos"
          className="text-sm text-amber-700 hover:underline"
        >
          Ver historial de stock
        </Link>
      </div>

      {ok === "1" && (
        <div className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Producción registrada y stock actualizado.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-stone-700">
          Producción de cajas — últimos 14 días
        </p>
        <ProduccionCajasChart data={datosGraficoCajas} />
      </div>

      <form action={registrarProduccion} className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-700">Bandejas (30 un.)</h2>
          <TablaProduccion productos={bandejas} mostrarFormato={false} />
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-700">Cajas (120 / 180 un.)</h2>
          <TablaProduccion productos={cajas} mostrarFormato={true} />
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-stone-700">Total de huevos del día</h2>
            <p className="text-xs text-stone-400">
              El total recolectado antes de clasificar por tamaño — es solo de referencia, no
              afecta el stock de ningún producto ni se descuenta de nada.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <label htmlFor="total_huevos" className="text-sm font-medium text-stone-800">
              Total de huevos recolectados hoy
            </label>
            <input
              id="total_huevos"
              type="number"
              name="total_huevos"
              min={0}
              placeholder="0"
              className="w-28 rounded-lg border border-stone-300 px-2 py-1 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-stone-700">
              Huevos rotos (no salen al mercado)
            </h2>
            <p className="text-xs text-stone-400">
              Se dejan aparte sin clasificar por tamaño, solo se cuenta el total del día — no
              afectan el stock de ningún producto, solo quedan registrados como pérdida.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50/40 p-4">
            <label htmlFor="merma" className="text-sm font-medium text-stone-800">
              Total de huevos rotos hoy
            </label>
            <input
              id="merma"
              type="number"
              name="merma"
              min={0}
              placeholder="0"
              className="w-28 rounded-lg border border-red-300 px-2 py-1 text-sm focus:border-red-600 focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-800"
        >
          Registrar producción de hoy
        </button>
        <p className="text-xs text-stone-400">
          Deja en blanco (o en 0) lo que hoy no tuvo movimiento. Si te equivocaste en una cantidad
          ya registrada, corrígelo con &quot;Ajustar stock&quot; en Productos y stock (para
          producción) o pide a un administrador que revise el historial (para mermas).
        </p>
      </form>

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
                    {totalPorDia.get(dia) ?? 0} unidades
                  </td>
                  <td className="py-2 text-right font-semibold text-stone-800">
                    {huevosPorDia.get(dia) ?? 0} unidades
                  </td>
                  <td className="py-2 text-right font-semibold text-red-600">
                    {mermaPorDia.get(dia) ?? 0} unidades
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
