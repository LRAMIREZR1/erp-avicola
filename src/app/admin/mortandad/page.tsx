import { createClient } from "@/lib/supabase/server";
import { formatFecha, hoyChile } from "@/lib/format";
import { requireRol } from "@/lib/roles";
import { registrarMortandad, ajustarPlantel } from "@/app/admin/mortandad/actions";
import StatCard from "@/components/StatCard";

export const dynamic = "force-dynamic";

interface MortandadEntry {
  id: string;
  fecha: string;
  cantidad: number;
  causa: string | null;
}

function haceDiasFecha(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

export default async function MortandadPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; ajuste?: string }>;
}) {
  await requireRol(["administrador", "encargado_bodega"]);
  const { ok, ajuste } = await searchParams;
  const supabase = await createClient();
  const hoy = hoyChile();

  const [{ data: plantel }, { data: entradas }] = await Promise.all([
    supabase
      .from("plantel_gallinas")
      .select("cantidad_actual")
      .eq("id", "principal")
      .single(),
    supabase
      .from("mortandad_gallinas")
      .select("id, fecha, cantidad, causa")
      .gte("fecha", haceDiasFecha(13))
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const lista = (entradas ?? []) as MortandadEntry[];
  const gallinasActivas = plantel?.cantidad_actual ?? 0;
  const muertasHoy = lista
    .filter((e) => e.fecha === hoy)
    .reduce((acc, e) => acc + e.cantidad, 0);
  const muertas14Dias = lista.reduce((acc, e) => acc + e.cantidad, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Mortandad</h1>
        <p className="text-sm text-stone-500">
          Registra las gallinas que mueren para mantener al día el plantel activo
        </p>
      </div>

      {ok === "1" && (
        <div className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Mortandad registrada y plantel actualizado.
        </div>
      )}
      {ajuste === "1" && (
        <div className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Plantel ajustado.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Gallinas activas"
          value={`${gallinasActivas} unidades`}
          hint="plantel actual"
        />
        <StatCard
          label={`Muertas hoy (${formatFecha(hoy)})`}
          value={`${muertasHoy} unidades`}
          tone={muertasHoy > 0 ? "danger" : "default"}
        />
        <StatCard
          label="Muertas — últimos 14 días"
          value={`${muertas14Dias} unidades`}
          tone={muertas14Dias > 0 ? "warning" : "default"}
        />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-700">Registrar mortandad de hoy</h2>
        <form
          action={registrarMortandad}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="sm:flex-1">
            <label htmlFor="cantidad" className="mb-1 block text-sm font-medium text-stone-800">
              Cantidad de gallinas
            </label>
            <input
              id="cantidad"
              type="number"
              name="cantidad"
              min={1}
              placeholder="0"
              required
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>
          <div className="sm:flex-[2]">
            <label htmlFor="causa" className="mb-1 block text-sm font-medium text-stone-800">
              Causa (opcional)
            </label>
            <input
              id="causa"
              type="text"
              name="causa"
              placeholder="Ej: calor, enfermedad, depredador…"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-red-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-800"
          >
            Registrar
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-stone-700">Ajustar plantel</h2>
        <p className="mb-3 text-xs text-stone-400">
          Para compras de gallinas nuevas o correcciones de conteo — usa un número positivo para
          sumar y negativo para restar.
        </p>
        <form action={ajustarPlantel} className="flex items-end gap-3">
          <div>
            <label htmlFor="delta" className="mb-1 block text-sm font-medium text-stone-800">
              Ajuste
            </label>
            <input
              id="delta"
              type="number"
              name="delta"
              placeholder="Ej: 50 o -3"
              required
              className="w-32 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            Ajustar
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-stone-700">Historial — últimos 14 días</p>
        {lista.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-400">
            Sin mortandad registrada en este período
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-stone-500">
                  <th className="pb-2 font-medium">Día</th>
                  <th className="pb-2 text-right font-medium">Cantidad</th>
                  <th className="pb-2 font-medium">Causa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lista.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 text-stone-700">
                      {formatFecha(e.fecha)}
                      {e.fecha === hoy && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Hoy
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right font-semibold text-red-600">
                      {e.cantidad} unidades
                    </td>
                    <td className="py-2 text-stone-600">{e.causa ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
