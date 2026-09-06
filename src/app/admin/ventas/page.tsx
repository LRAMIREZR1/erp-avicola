import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCLP, formatFecha } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function VentasPage() {
  const supabase = await createClient();
  const { data: ventas } = await supabase
    .from("pedidos")
    .select("id, total, fecha_pedido, pagado, fecha_pago, clientes(nombre)")
    .eq("origen", "venta_directa")
    .order("created_at", { ascending: false });

  const lista = ventas ?? [];
  const totalHoy = lista
    .filter((v) => v.fecha_pedido === new Date().toISOString().slice(0, 10))
    .reduce((acc, v) => acc + Number(v.total), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-stone-800">Venta directa</h1>
          <p className="text-sm text-stone-500">
            Ventas al contado que descuentan stock de inmediato — no pasan por reparto
          </p>
        </div>
        <Link
          href="/admin/ventas/nueva"
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          + Nueva venta directa
        </Link>
      </div>

      <p className="text-sm text-stone-500">
        Hoy: <span className="font-medium text-stone-800">{formatCLP(totalHoy)}</span>
      </p>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Pago</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {lista.map((v) => (
              <tr key={v.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-medium text-stone-800">
                  {(v as unknown as { clientes: { nombre: string } | null }).clientes?.nombre ??
                    "—"}
                </td>
                <td className="px-4 py-3 text-stone-600">{formatFecha(v.fecha_pedido)}</td>
                <td className="px-4 py-3 font-medium text-stone-800">
                  {formatCLP(Number(v.total))}
                </td>
                <td className="px-4 py-3 text-stone-500">
                  {v.pagado && v.fecha_pago ? `Pagado el ${formatFecha(v.fecha_pago)}` : "Sin pagar"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/pedidos/${v.id}`} className="text-amber-700 hover:underline">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                  Aún no hay ventas directas registradas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
