import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCLP, formatFecha } from "@/lib/format";
import EstadoPagoToggle from "@/components/EstadoPagoToggle";
import StatCard from "@/components/StatCard";
import { requireRol } from "@/lib/roles";

export const dynamic = "force-dynamic";

interface ItemDetalle {
  cantidad: number;
  productos: { nombre: string } | null;
}

export default async function CobranzasPage({
  searchParams,
}: {
  searchParams: Promise<{ pago?: string }>;
}) {
  await requireRol(["administrador", "vendedor"]);
  const { pago } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("pedidos")
    .select(
      "id, total, fecha_pedido, fecha_entrega, pagado, fecha_pago, clientes(nombre), pedido_items(cantidad, productos(nombre))"
    )
    .eq("estado", "entregado")
    .order("fecha_entrega", { ascending: false });

  if (pago === "pendiente") query = query.eq("pagado", false);
  if (pago === "pagado") query = query.eq("pagado", true);

  const { data: pedidos } = await query;
  const lista = pedidos ?? [];

  const pendientes = lista.filter((p) => !p.pagado);
  const pagados = lista.filter((p) => p.pagado);
  const totalPendiente = pendientes.reduce((acc, p) => acc + Number(p.total), 0);
  const totalCobrado = pagados.reduce((acc, p) => acc + Number(p.total), 0);

  const filtros: { label: string; value?: string }[] = [
    { label: "Todos" },
    { label: "Pendientes de cobro", value: "pendiente" },
    { label: "Pagados", value: "pagado" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Cobranzas</h1>
        <p className="text-sm text-stone-500">Pedidos entregados y su estado de pago</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Por cobrar"
          value={formatCLP(totalPendiente)}
          tone={pendientes.length > 0 ? "warning" : "default"}
          hint={`${pendientes.length} pedido${pendientes.length === 1 ? "" : "s"} sin pagar`}
        />
        <StatCard
          label="Cobrado"
          value={formatCLP(totalCobrado)}
          hint={`${pagados.length} pedido${pagados.length === 1 ? "" : "s"} pagado${pagados.length === 1 ? "" : "s"}`}
        />
      </div>

      <div className="flex gap-2">
        {filtros.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/admin/cobranzas?pago=${f.value}` : "/admin/cobranzas"}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              pago === f.value || (!pago && !f.value)
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
              <th className="px-4 py-3">Entrega</th>
              <th className="px-4 py-3">Detalle</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Pago</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {lista.map((p) => {
              const items = ((p as unknown as { pedido_items: ItemDetalle[] | null }).pedido_items ??
                []) as ItemDetalle[];
              return (
                <tr key={p.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-800">
                    {(p as unknown as { clientes: { nombre: string } | null }).clientes?.nombre ??
                      "—"}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {p.fecha_entrega ? formatFecha(p.fecha_entrega) : formatFecha(p.fecha_pedido)}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {items.length === 0 ? (
                      "—"
                    ) : (
                      <ul className="space-y-0.5">
                        {items.map((item, i) => (
                          <li key={i}>
                            {item.productos?.nombre ?? "Producto"} × {item.cantidad}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-stone-800">
                    {formatCLP(Number(p.total))}
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {p.pagado && p.fecha_pago ? `Pagado el ${formatFecha(p.fecha_pago)}` : "Sin pagar"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <EstadoPagoToggle pedidoId={p.id} pagado={p.pagado} />
                  </td>
                </tr>
              );
            })}
            {lista.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                  No hay pedidos entregados en esta vista
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
