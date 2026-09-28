import { createClient } from "@/lib/supabase/server";
import { formatCLP, formatFecha, hoyChile } from "@/lib/format";
import { requireRol } from "@/lib/roles";
import {
  registrarCosto,
  crearCategoriaCosto,
  renombrarCategoriaCosto,
} from "@/app/admin/costos/actions";
import StatCard from "@/components/StatCard";
import EliminarCostoButton from "@/components/EliminarCostoButton";
import EliminarCategoriaCostoButton from "@/components/EliminarCategoriaCostoButton";
import BotonEnviar from "@/components/BotonEnviar";

export const dynamic = "force-dynamic";

interface CategoriaCosto {
  id: string;
  nombre: string;
}

interface CostoEntry {
  id: string;
  fecha: string;
  monto: number;
  proveedor: string | null;
  notas: string | null;
  categorias_costo: { nombre: string } | null;
}

function primerDiaDelMes(hoy: string): string {
  return `${hoy.slice(0, 7)}-01`;
}

export default async function CostosPage({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string;
    catOk?: string;
    errorCategoria?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  await requireRol(["administrador"]);
  const { ok, catOk, errorCategoria, desde: desdeParam, hasta: hastaParam } = await searchParams;
  const supabase = await createClient();
  const hoy = hoyChile();
  const desde = desdeParam || primerDiaDelMes(hoy);
  const hasta = hastaParam || hoy;

  const [{ data: categorias }, { data: costosRows }] = await Promise.all([
    supabase.from("categorias_costo").select("id, nombre").order("nombre", { ascending: true }),
    supabase
      .from("costos")
      .select("id, fecha, monto, proveedor, notas, categorias_costo(nombre)")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const listaCategorias = (categorias ?? []) as CategoriaCosto[];
  const lista = (costosRows ?? []) as unknown as CostoEntry[];

  const totalCostos = lista.reduce((acc, c) => acc + Number(c.monto), 0);

  const porCategoria = new Map<string, number>();
  for (const c of lista) {
    const nombreCategoria = c.categorias_costo?.nombre ?? "Sin categoría";
    porCategoria.set(nombreCategoria, (porCategoria.get(nombreCategoria) ?? 0) + Number(c.monto));
  }
  const porCategoriaOrdenada = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);
  const categoriaConMasGasto = porCategoriaOrdenada[0] ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Costos</h1>
        <p className="text-sm text-stone-500">
          Gastos del negocio (luz, agua, sueldos, insumos, etc.) — se cruzan con las ventas en
          Reportes para calcular el margen
        </p>
      </div>

      {ok === "1" && (
        <div className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Costo registrado.
        </div>
      )}
      {catOk === "1" && (
        <div className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Categoría guardada.
        </div>
      )}
      {errorCategoria === "1" && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          Ya existe una categoría con ese nombre.
        </div>
      )}

      <form className="flex items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Desde</label>
          <input
            type="date"
            name="desde"
            defaultValue={desde}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Hasta</label>
          <input
            type="date"
            name="hasta"
            defaultValue={hasta}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900"
        >
          Filtrar
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total costos del período" value={formatCLP(totalCostos)} hint={`${desde} a ${hasta}`} />
        <StatCard label="Registros" value={lista.length} />
        <StatCard
          label="Categoría con más gasto"
          value={categoriaConMasGasto ? categoriaConMasGasto[0] : "—"}
          hint={categoriaConMasGasto ? formatCLP(categoriaConMasGasto[1]) : "Sin costos en el período"}
        />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-stone-700">Registrar costo</h2>
        <form
          action={registrarCosto}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <div>
            <label htmlFor="fecha" className="mb-1 block text-sm font-medium text-stone-800">
              Fecha
            </label>
            <input
              id="fecha"
              type="date"
              name="fecha"
              defaultValue={hoy}
              required
              className="w-40 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="categoria_id" className="mb-1 block text-sm font-medium text-stone-800">
              Categoría
            </label>
            <select
              id="categoria_id"
              name="categoria_id"
              required
              className="w-48 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            >
              {listaCategorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="monto" className="mb-1 block text-sm font-medium text-stone-800">
              Monto
            </label>
            <input
              id="monto"
              type="number"
              name="monto"
              min={1}
              placeholder="$"
              required
              className="w-36 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>
          <div className="sm:flex-1">
            <label htmlFor="proveedor" className="mb-1 block text-sm font-medium text-stone-800">
              A quién se le pagó (opcional)
            </label>
            <input
              id="proveedor"
              type="text"
              name="proveedor"
              placeholder="Ej: Enel, trabajador, ferretería"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
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
              placeholder="Ej: boleta 1234"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>
          <BotonEnviar
            pendingLabel="Registrando..."
            className="rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
          >
            Registrar
          </BotonEnviar>
        </form>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-stone-700">Categorías de costo</h2>
        <p className="mb-3 text-xs text-stone-400">
          Puedes agregar, renombrar o eliminar categorías. Una categoría solo se puede eliminar si
          no tiene costos registrados con ella.
        </p>

        <form action={crearCategoriaCosto} className="mb-4 flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="nombre_nueva" className="mb-1 block text-sm font-medium text-stone-800">
              Nueva categoría
            </label>
            <input
              id="nombre_nueva"
              type="text"
              name="nombre"
              placeholder="Ej: Combustible"
              required
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>
          <BotonEnviar
            pendingLabel="Agregando..."
            className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
          >
            Agregar
          </BotonEnviar>
        </form>

        <div className="divide-y divide-stone-100">
          {listaCategorias.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2 py-2">
              <form action={renombrarCategoriaCosto} className="flex flex-1 items-center gap-2">
                <input type="hidden" name="id" value={cat.id} />
                <input
                  key={cat.nombre}
                  type="text"
                  name="nombre"
                  defaultValue={cat.nombre}
                  required
                  className="w-full max-w-xs rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-amber-600 focus:outline-none"
                />
                <BotonEnviar
                  pendingLabel="Guardando..."
                  className="text-xs font-medium text-stone-600 hover:underline disabled:opacity-50"
                >
                  Guardar
                </BotonEnviar>
              </form>
              <EliminarCategoriaCostoButton categoriaId={cat.id} nombre={cat.nombre} />
            </div>
          ))}
          {listaCategorias.length === 0 && (
            <p className="py-4 text-center text-sm text-stone-400">Sin categorías todavía</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-stone-700">
          Historial de costos ({lista.length} registro{lista.length === 1 ? "" : "s"})
        </p>
        {lista.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-400">
            Sin costos registrados en este período
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-stone-500">
                  <th className="pb-2 pr-4 font-medium">Día</th>
                  <th className="pb-2 pr-4 font-medium">Categoría</th>
                  <th className="pb-2 pr-4 font-medium">A quién se pagó</th>
                  <th className="pb-2 pr-4 text-right font-medium">Monto</th>
                  <th className="pb-2 font-medium">Notas</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lista.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-4 text-stone-700">{formatFecha(c.fecha)}</td>
                    <td className="py-2 pr-4 text-stone-600">
                      {c.categorias_costo?.nombre ?? "Sin categoría"}
                    </td>
                    <td className="py-2 pr-4 text-stone-600">{c.proveedor ?? "—"}</td>
                    <td className="py-2 pr-4 text-right font-semibold text-stone-800">
                      {formatCLP(c.monto)}
                    </td>
                    <td className="py-2 text-stone-600">{c.notas ?? "—"}</td>
                    <td className="py-2 pl-4 text-right">
                      <EliminarCostoButton costoId={c.id} />
                    </td>
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
