import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCLP, formatFecha } from "@/lib/format";
import EstadoSelector from "@/components/EstadoSelector";
import type { EstadoPedido } from "@/lib/supabase/types";

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("pedidos")
    .select("id, estado, total, fecha_pedido, fecha_entrega, clientes(nombre), vendedores(nombre)")
    .order("created_at", { ascending: false });

  if (estado) {
    query = query.eq("estado", estado);
  }

  const { data: pedidos } = await query;

  const filtros: { label: string; value?: EstadoPedido }[] = [
    { label: "Todos" },
    { label: "Pendientes", value: "pendiente" },
    { label: "Confirmados", value: "confirmado" },
    { label: "En preparación", value: "en_preparacion" },
    { label: "Entregados", value: "entregado" },
    { label: "Cancelados", value: "cancelado" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-stone-800">Pedidos</h1>
          <p className="text-sm text-stone-500">Todos los pedidos registrados</p>
        </div>
        <Link
          href="/admin/pedidos/nuevo"
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          + Nuevo pedido
        </Link>
      </div>

      <div className="flex gap-2">
        {filtros.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/admin/pedidos?estado=${f.value}` : "/admin/pedidos"}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              estado === f.value || (!estado && !f.value)
                ? "bg-stone-800 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Vendedor</th>
              <th className="px-4 py-3">Fecha pedido</th>
              <th className="px-4 py-3">Entrega</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {(pedidos ?? []).map((p) => (
              <tr key={p.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-medium text-stone-800">
                  {(p as unknown as { clientes: { nombre: string } | null }).clientes?.nombre ??
                    "—"}
                </td>
                <td className="px-4 py-3 text-stone-600">
                  {(p as unknown as { vendedores: { nombre: string } | null }).vendedores
                    ?.nombre ?? "—"}
                </td>
                <td className="px-4 py-3 text-stone-600">{formatFecha(p.fecha_pedido)}</td>
                <td className="px-4 py-3 text-stone-600">
                  {p.fecha_entrega ? formatFecha(p.fecha_entrega) : "—"}
                </td>
                <td className="px-4 py-3 font-medium text-stone-800">
                  {formatCLP(Number(p.total))}
                </td>
                <td className="px-4 py-3">
                  <EstadoSelector pedidoId={p.id} estado={p.estado} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/pedidos/${p.id}`} className="text-amber-700 hover:underline">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {(pedidos ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                  No hay pedidos en esta vista
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
