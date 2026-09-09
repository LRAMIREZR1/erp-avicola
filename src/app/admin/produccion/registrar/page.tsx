import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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

// Página de solo carga de datos — el formulario de producción diaria. Los
// indicadores y gráficos para tomar decisiones viven aparte, en
// /admin/produccion, para no mezclar "mirar" con "cargar".
export default async function RegistrarProduccionPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  await requireRol(["administrador", "encargado_bodega"]);
  const { ok } = await searchParams;
  const supabase = await createClient();

  const { data: productos } = await supabase.from("productos").select("*").eq("activo", true);

  const todos = [...(productos ?? [])].sort((a, b) => {
    const diff =
      ORDEN_CATEGORIA[a.categoria as Categoria] - ORDEN_CATEGORIA[b.categoria as Categoria];
    if (diff !== 0) return diff;
    return a.nombre.localeCompare(b.nombre);
  });
  const bandejas = todos.filter((p) => p.formato === "bandeja_30");
  const cajas = todos.filter((p) => p.formato !== "bandeja_30");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Registrar producción</h1>
        <p className="text-sm text-stone-500">
          Registra cuántas unidades se recolectaron/clasificaron hoy — el stock se suma
          automáticamente
        </p>
      </div>

      {ok === "1" && (
        <div className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Producción registrada y stock actualizado.{" "}
          <Link href="/admin/produccion" className="underline">
            Ver indicadores actualizados
          </Link>
        </div>
      )}

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
    </div>
  );
}
