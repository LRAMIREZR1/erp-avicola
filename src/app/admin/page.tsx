import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCLP, hoyChile } from "@/lib/format";
import StatCard from "@/components/StatCard";
import StockChart, { type StockChartDatum } from "@/components/StockChart";
import StockFisicoChart, { type StockFisicoDatum } from "@/components/StockFisicoChart";
import { requireRol } from "@/lib/roles";
import {
  NOMBRES_CATEGORIA,
  NOMBRES_ESTADO,
  type Categoria,
  type EstadoPedido,
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

interface ProductoStockBajo {
  id: string;
  nombre: string;
  stock_actual: number;
  stock_minimo: number;
}

function TablaAlertaStock({
  titulo,
  productos,
}: {
  titulo: string;
  productos: ProductoStockBajo[];
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
        {titulo}
      </p>
      {productos.length === 0 ? (
        <p className="text-sm text-amber-700/70">Sin alertas</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-amber-700">
              <th className="pb-1 font-medium">Producto</th>
              <th className="pb-1 text-right font-medium">Quedan</th>
              <th className="pb-1 text-right font-medium">Mínimo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-200">
            {productos.map((p) => (
              <tr key={p.id}>
                <td className="py-1 text-amber-900">{p.nombre}</td>
                <td className="py-1 text-right font-medium text-amber-900">{p.stock_actual}</td>
                <td className="py-1 text-right text-amber-700">{p.stock_minimo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const rol = await requireRol(["administrador", "vendedor"]);
  const supabase = await createClient();
  const hoy = hoyChile();

  const [pedidosHoy, pendientes, stockBajo, ultimosPedidos, itemsReservados] = await Promise.all([
    supabase
      .from("pedidos")
      .select("total")
      .eq("fecha_pedido", hoy)
      .neq("estado", "cancelado")
      .neq("estado", "eliminado"),
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
      .neq("estado", "eliminado")
      .order("created_at", { ascending: false })
      .limit(6),
    // Pedidos ya confirmados/en preparación pero aún no entregados: el
    // stock ya se descontó de "disponible" (trigger al confirmar), pero las
    // cajas siguen físicamente en la bodega hasta que se despachan.
    // El gráfico de stock físico es solo para administrador (el vendedor no
    // lo ve en el Resumen; el encargado de bodega lo ve en Productos y
    // stock), así que no vale la pena pedirlo si no se va a mostrar.
    rol === "administrador"
      ? supabase
          .from("pedido_items")
          .select("cantidad, productos(categoria, formato), pedidos!inner(estado)")
          .in("pedidos.estado", ["confirmado", "en_preparacion"])
      : Promise.resolve({ data: [] as { cantidad: number; productos: unknown }[] }),
  ]);

  const totalHoy = (pedidosHoy.data ?? []).reduce((acc, p) => acc + Number(p.total), 0);
  const stockProductos = stockBajo.data ?? [];
  const productosStockBajo = stockProductos.filter((p) => p.stock_actual <= p.stock_minimo);
  const bandejasStockBajo = productosStockBajo.filter((p) => p.formato === "bandeja_30");
  const cajasStockBajo = productosStockBajo.filter((p) => p.formato !== "bandeja_30");

  const stockOrdenado = [...stockProductos].sort(
    (a, b) => ORDEN_CATEGORIA[a.categoria as Categoria] - ORDEN_CATEGORIA[b.categoria as Categoria]
  );

  const stockPorCategoria = new Map<string, StockChartDatum>();
  for (const p of stockOrdenado) {
    const nombreCategoria = NOMBRES_CATEGORIA[p.categoria as Categoria];
    const actual = stockPorCategoria.get(nombreCategoria) ?? {
      categoria: nombreCategoria,
      bandejas: 0,
      cajas: 0,
    };
    if (p.formato === "bandeja_30") {
      actual.bandejas += p.stock_actual;
    } else {
      actual.cajas += p.stock_actual;
    }
    stockPorCategoria.set(nombreCategoria, actual);
  }
  const datosGrafico = [...stockPorCategoria.values()];

  // Reservado = comprometido en pedidos confirmados/en preparación que aún
  // no llegan a "entregado". Se agrupa igual que el disponible, por
  // categoría y formato, para poder sumarlos en el gráfico de stock físico.
  const reservadoPorCategoria = new Map<string, { bandejas: number; cajas: number }>();
  for (const item of itemsReservados.data ?? []) {
    const producto = (
      item as unknown as { productos: { categoria: Categoria; formato: string } | null }
    ).productos;
    if (!producto) continue;
    const nombreCategoria = NOMBRES_CATEGORIA[producto.categoria];
    const actual = reservadoPorCategoria.get(nombreCategoria) ?? { bandejas: 0, cajas: 0 };
    if (producto.formato === "bandeja_30") {
      actual.bandejas += item.cantidad;
    } else {
      actual.cajas += item.cantidad;
    }
    reservadoPorCategoria.set(nombreCategoria, actual);
  }

  const datosGraficoFisico: StockFisicoDatum[] = datosGrafico.map((d) => {
    const reservado = reservadoPorCategoria.get(d.categoria) ?? { bandejas: 0, cajas: 0 };
    return {
      categoria: d.categoria,
      bandejasDisponible: d.bandejas,
      bandejasReservado: reservado.bandejas,
      cajasDisponible: d.cajas,
      cajasReservado: reservado.cajas,
    };
  });

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
          <p className="mb-3 text-sm font-medium text-amber-800">Alertas de stock bajo</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TablaAlertaStock titulo="Bandejas" productos={bandejasStockBajo} />
            <TablaAlertaStock titulo="Cajas" productos={cajasStockBajo} />
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-stone-700">Stock disponible por categoría</p>
          <Link href="/admin/productos" className="text-sm text-amber-700 hover:underline">
            Gestionar
          </Link>
        </div>
        {datosGrafico.length > 0 ? (
          <StockChart data={datosGrafico} />
        ) : (
          <p className="py-4 text-center text-sm text-stone-400">Aún no hay productos</p>
        )}
      </div>

      {rol === "administrador" && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-stone-700">Stock físico en bodega</p>
              <p className="text-xs text-stone-400">
                Incluye lo reservado en pedidos confirmados que aún no se despachan
              </p>
            </div>
            <Link href="/admin/produccion" className="text-sm text-amber-700 hover:underline">
              Producción diaria
            </Link>
          </div>
          {datosGraficoFisico.length > 0 ? (
            <StockFisicoChart data={datosGraficoFisico} />
          ) : (
            <p className="py-4 text-center text-sm text-stone-400">Aún no hay productos</p>
          )}
        </div>
      )}

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
