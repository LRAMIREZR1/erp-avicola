import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCLP, hoyChile, sumarDias } from "@/lib/format";
import StatCard from "@/components/StatCard";
import TablaConsolidado, { esCaja, type ItemConsolidado } from "@/components/TablaConsolidado";
import { requireRol } from "@/lib/roles";

export const dynamic = "force-dynamic";

interface PedidoEntregado {
  id: string;
  total: number;
  pagado: boolean;
  clientes: { nombre: string; zona_entrega: string | null } | null;
  pedido_items: {
    cantidad: number;
    productos: {
      id: string;
      nombre: string;
      categoria: string;
      formato: string;
    } | null;
  }[];
}

// Nombre del día en español, para el encabezado ("miércoles 3 de septiembre").
function nombreDia(fecha: string) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${fecha}T00:00:00Z`));
}

export default async function HistorialRepartoPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const rol = await requireRol(["administrador", "vendedor", "encargado_bodega", "repartidor"]);
  const { fecha: fechaParam } = await searchParams;
  const hoy = hoyChile();
  const fecha = fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam) ? fechaParam : hoy;

  const supabase = await createClient();
  const { data } = await supabase
    .from("pedidos")
    .select(
      "id, total, pagado, clientes(nombre, zona_entrega), pedido_items(cantidad, productos(id, nombre, categoria, formato))"
    )
    .eq("estado", "entregado")
    .eq("fecha_entregado", fecha)
    .order("created_at", { ascending: true });

  const lista = (data ?? []) as unknown as PedidoEntregado[];
  const listaOrdenada = [...lista].sort((a, b) =>
    (a.clientes?.nombre ?? "").localeCompare(b.clientes?.nombre ?? "")
  );

  const consolidadoMap = new Map<string, ItemConsolidado>();
  for (const p of lista) {
    for (const item of p.pedido_items ?? []) {
      const producto = item.productos;
      if (!producto) continue;
      const actual = consolidadoMap.get(producto.id) ?? {
        producto_id: producto.id,
        nombre: producto.nombre,
        categoria: producto.categoria,
        formato: producto.formato,
        cantidad: 0,
      };
      actual.cantidad += item.cantidad;
      consolidadoMap.set(producto.id, actual);
    }
  }
  const consolidado = [...consolidadoMap.values()].sort((a, b) => {
    if (a.categoria !== b.categoria) return a.categoria.localeCompare(b.categoria);
    return a.formato.localeCompare(b.formato);
  });
  const consolidadoCajas = consolidado.filter((i) => esCaja(i.formato));
  const consolidadoBandejas = consolidado.filter((i) => !esCaja(i.formato));

  const totalEntregado = lista.reduce((acc, p) => acc + Number(p.total), 0);
  const totalCobrado = lista.filter((p) => p.pagado).reduce((acc, p) => acc + Number(p.total), 0);
  const totalPendiente = totalEntregado - totalCobrado;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-stone-800">Historial de repartos</h1>
          <p className="text-sm text-stone-500 capitalize">{nombreDia(fecha)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/reparto/historial?fecha=${sumarDias(fecha, -1)}`}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600 hover:bg-stone-100"
            title="Día anterior"
          >
            ← Anterior
          </Link>
          <form action="/admin/reparto/historial" className="flex items-center gap-2">
            <input
              type="date"
              name="fecha"
              defaultValue={fecha}
              max={hoy}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
            >
              Ver
            </button>
          </form>
          {fecha !== hoy && (
            <Link
              href={`/admin/reparto/historial?fecha=${sumarDias(fecha, 1)}`}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600 hover:bg-stone-100"
              title="Día siguiente"
            >
              Siguiente →
            </Link>
          )}
        </div>
      </div>

      <Link href="/admin/reparto" className="inline-block text-sm text-amber-700 hover:underline">
        ← Volver a la carga de hoy
      </Link>

      {lista.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-400">
          No se entregó ningún pedido ese día
        </div>
      ) : (
        <>
          {rol !== "encargado_bodega" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                label="Entregado"
                value={formatCLP(totalEntregado)}
                hint={`${lista.length} pedido${lista.length === 1 ? "" : "s"}`}
              />
              <StatCard label="Cobrado" value={formatCLP(totalCobrado)} />
              <StatCard
                label="Pendiente de cobro"
                value={formatCLP(totalPendiente)}
                tone={totalPendiente > 0 ? "warning" : "default"}
              />
            </div>
          )}

          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="mb-3 text-sm font-medium text-stone-700">
              Consolidado entregado ({lista.length} pedido{lista.length === 1 ? "" : "s"})
            </p>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-stone-700">Cajas (120 / 180 un.)</h2>
              <TablaConsolidado
                items={consolidadoCajas}
                etiquetaCantidad="Cantidad entregada"
                marcarCasillero={false}
              />
            </div>

            <div className="mt-5 space-y-3">
              <h2 className="text-sm font-semibold text-stone-700">Bandejas (30 un.)</h2>
              <TablaConsolidado
                items={consolidadoBandejas}
                etiquetaCantidad="Cantidad entregada"
                marcarCasillero={false}
              />
            </div>
          </div>

          {rol !== "encargado_bodega" && (
            <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
              <div className="p-4 pb-3">
                <p className="text-sm font-medium text-stone-700">Pedidos entregados</p>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-200 text-xs font-semibold uppercase tracking-wide text-stone-600">
                  <tr>
                    <th className="px-4 py-2">Cliente</th>
                    <th className="px-4 py-2">Zona</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {listaOrdenada.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2 font-medium text-stone-800">
                        {p.clientes?.nombre ?? "Cliente"}
                      </td>
                      <td className="px-4 py-2 text-stone-600">
                        {p.clientes?.zona_entrega ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {p.pagado ? (
                          <span className="font-semibold text-green-700">PAGADO</span>
                        ) : (
                          <span className="font-semibold text-amber-700">
                            {formatCLP(Number(p.total))}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
