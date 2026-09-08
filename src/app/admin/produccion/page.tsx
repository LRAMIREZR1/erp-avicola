import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { diaChileDe, formatFecha, hoyChile } from "@/lib/format";
import { requireRol } from "@/lib/roles";
import { registrarProduccion } from "@/app/admin/produccion/actions";
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

  const [{ data: productos }, { data: movimientos }] = await Promise.all([
    supabase.from("productos").select("*").eq("activo", true),
    supabase
      .from("movimientos_stock")
      .select("cantidad, created_at")
      .eq("motivo", MOTIVO_PRODUCCION)
      .gte("created_at", haceDias(13))
      .order("created_at", { ascending: false }),
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
  for (const m of movimientos ?? []) {
    const dia = diaChileDe(m.created_at);
    totalPorDia.set(dia, (totalPorDia.get(dia) ?? 0) + m.cantidad);
  }
  const diasOrdenados = [...totalPorDia.keys()].sort((a, b) => b.localeCompare(a));
  const totalHoy = totalPorDia.get(hoy) ?? 0;

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

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-stone-700">
          Producción de hoy ({formatFecha(hoy)})
        </p>
        <p className="text-2xl font-semibold text-stone-800">{totalHoy} unidades</p>
        <p className="text-xs text-stone-400">ya registradas hoy en el sistema</p>
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

        <button
          type="submit"
          className="rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-800"
        >
          Registrar producción de hoy
        </button>
        <p className="text-xs text-stone-400">
          Deja en blanco (o en 0) los productos que hoy no tuvieron producción. Si te equivocaste
          en una cantidad, corrígelo con &quot;Ajustar stock&quot; en Productos y stock.
        </p>
      </form>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-stone-700">Producción de los últimos 14 días</p>
          <Link
            href="/admin/productos/movimientos"
            className="text-sm text-amber-700 hover:underline"
          >
            Ver detalle
          </Link>
        </div>
        {diasOrdenados.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-400">Aún no hay producción registrada</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-stone-500">
                <th className="pb-2 font-medium">Día</th>
                <th className="pb-2 text-right font-medium">Total producido</th>
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
                    {totalPorDia.get(dia)} unidades
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
