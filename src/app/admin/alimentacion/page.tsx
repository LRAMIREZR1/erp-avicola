import { createClient } from "@/lib/supabase/server";
import { formatCLP, formatFecha, hoyChile, sumarDias } from "@/lib/format";
import { requireRol } from "@/lib/roles";
import {
  registrarCompraAlimento,
  ajustarConsumoAlimento,
  ajustarStockAlimento,
} from "@/app/admin/alimentacion/actions";
import { consumoDiarioKg, diasRestantes, proyectarKilosHoy } from "@/lib/alimentacion";
import StatCard from "@/components/StatCard";

export const dynamic = "force-dynamic";

interface CompraEntry {
  id: string;
  fecha: string;
  proveedor: string | null;
  kilos: number;
  costo_total: number | null;
  notas: string | null;
}

export default async function AlimentacionPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; consumo?: string; ajuste?: string }>;
}) {
  await requireRol(["administrador", "encargado_bodega"]);
  const { ok, consumo, ajuste } = await searchParams;
  const supabase = await createClient();
  const hoy = hoyChile();

  const [{ data: stockRow }, { data: plantel }, { data: compras }] = await Promise.all([
    supabase
      .from("alimento_stock")
      .select("kilos_actual, checkpoint_fecha, gramos_por_gallina")
      .eq("id", "principal")
      .single(),
    supabase.from("plantel_gallinas").select("cantidad_actual").eq("id", "principal").single(),
    supabase
      .from("alimento_compras")
      .select("id, fecha, proveedor, kilos, costo_total, notas")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const stock = stockRow ?? {
    kilos_actual: 0,
    checkpoint_fecha: hoy,
    gramos_por_gallina: 0,
  };
  const gallinasActivas = plantel?.cantidad_actual ?? 0;
  const lista = (compras ?? []) as CompraEntry[];

  const kilosHoy = proyectarKilosHoy(stock, gallinasActivas, hoy);
  const consumoDiario = consumoDiarioKg(stock.gramos_por_gallina, gallinasActivas);
  const diasQueQuedan = diasRestantes(kilosHoy, consumoDiario);
  const fechaAgotamiento =
    diasQueQuedan !== null ? sumarDias(hoy, diasQueQuedan) : null;

  const alertaActiva = diasQueQuedan !== null && diasQueQuedan <= 7;
  const alertaCritica = diasQueQuedan !== null && diasQueQuedan <= 2;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Alimentación</h1>
        <p className="text-sm text-stone-500">
          Compras de alimento y proyección de cuándo se agota el stock
        </p>
      </div>

      {ok === "1" && (
        <div className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Compra registrada y stock actualizado.
        </div>
      )}
      {consumo === "1" && (
        <div className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Consumo diario actualizado.
        </div>
      )}
      {ajuste === "1" && (
        <div className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Stock ajustado.
        </div>
      )}

      {alertaActiva && (
        <div
          className={`rounded-2xl border p-4 ${
            alertaCritica ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              alertaCritica ? "text-red-800" : "text-amber-800"
            }`}
          >
            {diasQueQuedan === 0
              ? "El alimento se acaba hoy"
              : `Quedan ${diasQueQuedan} día${diasQueQuedan === 1 ? "" : "s"} de alimento`}
          </p>
          <p className={`mt-1 text-sm ${alertaCritica ? "text-red-700" : "text-amber-700"}`}>
            Al ritmo de consumo actual se agotaría el {fechaAgotamiento && formatFecha(fechaAgotamiento)}.
            Conviene solicitar la compra ahora para no quedarse sin stock.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Gallinas activas" value={`${gallinasActivas} unidades`} />
        <StatCard
          label="Stock estimado hoy"
          value={`${kilosHoy.toFixed(1)} kg`}
          hint={`Último checkpoint: ${formatFecha(stock.checkpoint_fecha)}`}
        />
        <StatCard
          label="Consumo diario"
          value={`${consumoDiario.toFixed(1)} kg/día`}
          hint={`${stock.gramos_por_gallina} g por gallina`}
        />
        <StatCard
          label="Días restantes"
          value={diasQueQuedan === null ? "—" : diasQueQuedan}
          tone={alertaCritica ? "danger" : alertaActiva ? "warning" : "default"}
          hint={fechaAgotamiento ? `Se agotaría el ${formatFecha(fechaAgotamiento)}` : "Sin proyección"}
        />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-700">Registrar compra de alimento</h2>
        <form
          action={registrarCompraAlimento}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <div>
            <label htmlFor="kilos" className="mb-1 block text-sm font-medium text-stone-800">
              Kilos comprados
            </label>
            <input
              id="kilos"
              type="number"
              name="kilos"
              min={1}
              step="0.1"
              placeholder="0"
              required
              className="w-36 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>
          <div className="sm:flex-1">
            <label htmlFor="proveedor" className="mb-1 block text-sm font-medium text-stone-800">
              Proveedor (opcional)
            </label>
            <input
              id="proveedor"
              type="text"
              name="proveedor"
              placeholder="Ej: Agrosuper"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="costo_total" className="mb-1 block text-sm font-medium text-stone-800">
              Costo total (opcional)
            </label>
            <input
              id="costo_total"
              type="number"
              name="costo_total"
              min={0}
              placeholder="$"
              className="w-36 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>
          <div className="sm:flex-1">
            <label htmlFor="notas" className="mb-1 block text-sm font-medium text-stone-800">
              Notas (opcional)
            </label>
            <input
              id="notas"
              type="text"
              name="notas"
              placeholder="Ej: factura 1234"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-800"
          >
            Registrar
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-700">Ajustar consumo diario</h2>
          <p className="mb-3 text-xs text-stone-400">
            Gramos de alimento por gallina al día — se usa para proyectar cuándo se agota el
            stock. El cambio rige desde hoy, no afecta el cálculo de días anteriores.
          </p>
          <form action={ajustarConsumoAlimento} className="flex items-end gap-3">
            <div>
              <label
                htmlFor="gramos_por_gallina"
                className="mb-1 block text-sm font-medium text-stone-800"
              >
                Gramos por gallina
              </label>
              <input
                id="gramos_por_gallina"
                type="number"
                name="gramos_por_gallina"
                min={0}
                step="1"
                defaultValue={stock.gramos_por_gallina}
                required
                className="w-32 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              Guardar
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-700">Ajustar stock a mano</h2>
          <p className="mb-3 text-xs text-stone-400">
            Para mermas o correcciones de conteo — usa un número positivo para sumar kilos y
            negativo para restar.
          </p>
          <form action={ajustarStockAlimento} className="flex items-end gap-3">
            <div>
              <label htmlFor="delta" className="mb-1 block text-sm font-medium text-stone-800">
                Ajuste (kg)
              </label>
              <input
                id="delta"
                type="number"
                name="delta"
                step="0.1"
                placeholder="Ej: 20 o -5"
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
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-stone-700">
          Historial de compras ({lista.length} registro{lista.length === 1 ? "" : "s"})
        </p>
        {lista.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-400">Sin compras registradas todavía</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-stone-500">
                  <th className="pb-2 pr-4 font-medium">Día</th>
                  <th className="pb-2 pr-4 font-medium">Proveedor</th>
                  <th className="pb-2 pr-4 text-right font-medium">Kilos</th>
                  <th className="pb-2 pr-4 text-right font-medium">Costo total</th>
                  <th className="pb-2 font-medium">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lista.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-4 text-stone-700">
                      {formatFecha(c.fecha)}
                      {c.fecha === hoy && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Hoy
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-stone-600">{c.proveedor ?? "—"}</td>
                    <td className="py-2 pr-4 text-right font-semibold text-stone-800">
                      {c.kilos} kg
                    </td>
                    <td className="py-2 pr-4 text-right text-stone-600">
                      {c.costo_total != null ? formatCLP(c.costo_total) : "—"}
                    </td>
                    <td className="py-2 text-stone-600">{c.notas ?? "—"}</td>
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
