import { createClient } from "@/lib/supabase/server";
import { formatCLP } from "@/lib/format";
import StatCard from "@/components/StatCard";

function primerDiaDelMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const params = await searchParams;
  const desde = params.desde || primerDiaDelMes();
  const hasta = params.hasta || hoy();

  const supabase = await createClient();

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id, total, fecha_pedido, estado, vendedores(nombre)")
    .neq("estado", "cancelado")
    .gte("fecha_pedido", desde)
    .lte("fecha_pedido", hasta);

  const { data: itemsVendidos } = await supabase
    .from("pedido_items")
    .select(
      "cantidad, precio_unitario, precio_lista, subtotal, productos(nombre), pedidos!inner(fecha_pedido, estado, clientes(nombre))"
    )
    .neq("pedidos.estado", "cancelado")
    .gte("pedidos.fecha_pedido", desde)
    .lte("pedidos.fecha_pedido", hasta);

  const totalPeriodo = (pedidos ?? []).reduce((acc, p) => acc + Number(p.total), 0);
  const cantidadPedidos = (pedidos ?? []).length;

  let totalDescuento = 0;
  const porClienteDescuento = new Map<string, number>();
  for (const item of itemsVendidos ?? []) {
    const precioLista = Number(item.precio_lista ?? item.precio_unitario);
    const descuentoLinea = (precioLista - Number(item.precio_unitario)) * item.cantidad;
    if (descuentoLinea > 0.5) {
      totalDescuento += descuentoLinea;
      const nombreCliente =
        (
          item as unknown as {
            pedidos: { clientes: { nombre: string } | null } | null;
          }
        ).pedidos?.clientes?.nombre ?? "Cliente";
      porClienteDescuento.set(
        nombreCliente,
        (porClienteDescuento.get(nombreCliente) ?? 0) + descuentoLinea
      );
    }
  }
  const clientesConDescuento = [...porClienteDescuento.entries()].sort((a, b) => b[1] - a[1]);

  const porVendedor = new Map<string, number>();
  for (const p of pedidos ?? []) {
    const nombre =
      (p as unknown as { vendedores: { nombre: string } | null }).vendedores?.nombre ??
      "Sin asignar";
    porVendedor.set(nombre, (porVendedor.get(nombre) ?? 0) + Number(p.total));
  }

  const porProducto = new Map<string, { cantidad: number; total: number }>();
  for (const item of itemsVendidos ?? []) {
    const nombre =
      (item as unknown as { productos: { nombre: string } | null }).productos?.nombre ??
      "Producto";
    const actual = porProducto.get(nombre) ?? { cantidad: 0, total: 0 };
    actual.cantidad += item.cantidad;
    actual.total += Number(item.subtotal);
    porProducto.set(nombre, actual);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Reportes de ventas</h1>
        <p className="text-sm text-stone-500">No incluye pedidos cancelados</p>
      </div>

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
        <StatCard label="Total vendido" value={formatCLP(totalPeriodo)} hint={`${desde} a ${hasta}`} />
        <StatCard label="Pedidos" value={cantidadPedidos} hint="No cancelados" />
        <StatCard
          label="Descuentos otorgados"
          value={formatCLP(totalDescuento)}
          tone={totalDescuento > 0 ? "warning" : "default"}
          hint={
            totalPeriodo > 0
              ? `${((totalDescuento / (totalPeriodo + totalDescuento)) * 100).toFixed(1)}% del valor de lista`
              : "Sin ventas en el período"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-stone-700">Por vendedor</p>
          <div className="divide-y divide-stone-100">
            {[...porVendedor.entries()].map(([nombre, total]) => (
              <div key={nombre} className="flex items-center justify-between py-2 text-sm">
                <span className="text-stone-600">{nombre}</span>
                <span className="font-medium text-stone-800">{formatCLP(total)}</span>
              </div>
            ))}
            {porVendedor.size === 0 && (
              <p className="py-4 text-center text-sm text-stone-400">Sin datos</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-stone-700">Por producto</p>
          <div className="divide-y divide-stone-100">
            {[...porProducto.entries()].map(([nombre, datos]) => (
              <div key={nombre} className="flex items-center justify-between py-2 text-sm">
                <span className="text-stone-600">
                  {nombre} × {datos.cantidad}
                </span>
                <span className="font-medium text-stone-800">{formatCLP(datos.total)}</span>
              </div>
            ))}
            {porProducto.size === 0 && (
              <p className="py-4 text-center text-sm text-stone-400">Sin datos</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-stone-700">Descuentos por cliente</p>
        <div className="divide-y divide-stone-100">
          {clientesConDescuento.map(([nombre, monto]) => (
            <div key={nombre} className="flex items-center justify-between py-2 text-sm">
              <span className="text-stone-600">{nombre}</span>
              <span className="font-medium text-amber-700">-{formatCLP(monto)}</span>
            </div>
          ))}
          {clientesConDescuento.length === 0 && (
            <p className="py-4 text-center text-sm text-stone-400">
              Sin descuentos otorgados en este período
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
