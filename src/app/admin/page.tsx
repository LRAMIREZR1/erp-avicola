import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCLP } from "@/lib/format";
import StatCard from "@/components/StatCard";
import {
  NOMBRES_CATEGORIA,
  NOMBRES_ESTADO,
  NOMBRES_FORMATO,
  type Categoria,
  type EstadoPedido,
  type Formato,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const hoy = new Date().toISOString().slice(0, 10);

  const [pedidosHoy, pendientes, stockBajo, ultimosPedidos] = await Promise.all([
    supabase.from("pedidos").select("total").eq("fecha_pedido", hoy).neq("estado", "cancelado"),
    supabase
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .in("estado", ["pendiente", "en_preparacion"]),
    supabase
      .from("productos")
      .select("id, nombre, categoria, formato, stock_actual, stock_minimo")
      .eq("activo", true)
      .order("categoria")
      .order("formato"),
    supabase
      .from("pedidos")
      .select("id, estado, total, fecha_pedido, clientes(nombre)")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const totalHoy = (pedidosHoy.data ?? []).reduce((acc, p) => acc + Number(p.total), 0);
  const stockProductos = stockBajo.data ?? [];
  const productosStockBajo = stockProductos.filter((p) => p.stock_actual <= p.stock_minimo);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Resumen</h1>
        <p className="text-sm text-stone-500">Vista general del negocio hoy</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Ventas de hoy" value={formatCLP(totalHoy)} hint={hoy} />
        <StatCard
          label="Pedidos pendientes"
          value={pendientes.count ?? 0}
          hint="Pendientes + en preparación"
        />
        <StatCard
          label="Productos con stock bajo"
          value={productosStockBajo.length}
          tone={productosStockBajo.length > 0 ? "warning" : "default"}
          hint={productosStockBajo.length > 0 ? "Revisar stock" : "Todo en orden"}
        />
      </div>

      {productosStockBajo.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-medium text-amber-800">Alertas de stock bajo</p>
          <ul className="space-y-1 text-sm text-amber-800">
            {productosStockBajo.map((p) => (
              <li key={p.id}>
                {p.nombre}: quedan {p.stock_actual} (mínimo {p.stock_minimo})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-stone-700">Stock disponible</p>
          <Link href="/admin/productos" className="text-sm text-amber-700 hover:underline">
            Gestionar
          </Link>
        </div>
        <div className="divide-y divide-stone-100">
          {stockProductos.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-stone-700">
                {NOMBRES_CATEGORIA[p.categoria as Categoria]} —{" "}
                {NOMBRES_FORMATO[p.formato as Formato]}
              </span>
              <span
                className={
                  p.stock_actual <= p.stock_minimo
                    ? "font-semibold text-red-600"
                    : "font-medium text-stone-800"
                }
              >
                {p.stock_actual} disponibles
              </span>
            </div>
          ))}
          {stockProductos.length === 0 && (
            <p className="py-4 text-center text-sm text-stone-400">Aún no hay productos</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-stone-700">Últimos pedidos</p>
          <Link href="/admin/pedidos" className="text-sm text-amber-700 hover:underline">
            Ver todos
          </Link>
        </div>
        <div className="divide-y divide-stone-100">
          {(ultimosPedidos.data ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-stone-700">
                {(p as unknown as { clientes: { nombre: string } | null }).clientes?.nombre ??
                  "Cliente"}
              </span>
              <span className="text-stone-500">
                {NOMBRES_ESTADO[p.estado as EstadoPedido]}
              </span>
              <span className="font-medium text-stone-800">{formatCLP(Number(p.total))}</span>
            </div>
          ))}
          {(ultimosPedidos.data ?? []).length === 0 && (
            <p className="py-4 text-center text-sm text-stone-400">Aún no hay pedidos</p>
          )}
        </div>
      </div>
    </div>
  );
}
