import { createClient } from "@/lib/supabase/server";
import { formatCLP } from "@/lib/format";
import StatCard from "@/components/StatCard";
import { requireRol } from "@/lib/roles";
import { NOMBRES_CATEGORIA, NOMBRES_FORMATO, type Categoria, type Formato } from "@/lib/supabase/types";

// Orden por tamaño del huevo, de mayor a menor — no alfabético.
const ORDEN_CATEGORIA: Record<Categoria, number> = {
  super_extra: 0,
  extra: 1,
  primera: 2,
  segunda: 3,
  tercera: 4,
};
const CATEGORIAS_ORDENADAS = (Object.keys(ORDEN_CATEGORIA) as Categoria[]).sort(
  (a, b) => ORDEN_CATEGORIA[a] - ORDEN_CATEGORIA[b]
);

function primerDiaDelMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string) {
  const d1 = new Date(`${desde}T00:00:00Z`);
  const d2 = new Date(`${hasta}T00:00:00Z`);
  return Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
}

// Calcula el rango inmediatamente anterior, de la misma cantidad de días,
// para poder comparar "esta semana vs. la semana pasada" (o el rango que
// haya elegido el usuario).
function periodoAnterior(desde: string, hasta: string) {
  const dias = diasEntre(desde, hasta);
  const finAnterior = new Date(`${desde}T00:00:00Z`);
  finAnterior.setUTCDate(finAnterior.getUTCDate() - 1);
  const inicioAnterior = new Date(finAnterior);
  inicioAnterior.setUTCDate(inicioAnterior.getUTCDate() - (dias - 1));
  return {
    desde: inicioAnterior.toISOString().slice(0, 10),
    hasta: finAnterior.toISOString().slice(0, 10),
  };
}

function formatCambio(actual: number, anterior: number) {
  if (anterior <= 0) {
    return { texto: "Sin ventas en el período anterior para comparar", clase: "text-stone-500" };
  }
  const cambio = ((actual - anterior) / anterior) * 100;
  const signo = cambio >= 0 ? "+" : "";
  const clase = cambio > 0 ? "text-green-700" : cambio < 0 ? "text-red-600" : "text-stone-500";
  return {
    texto: `${signo}${cambio.toFixed(1)}% vs. período anterior (${formatCLP(anterior)})`,
    clase,
  };
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await requireRol(["administrador"]);
  const params = await searchParams;
  const desde = params.desde || primerDiaDelMes();
  const hasta = params.hasta || hoy();
  const anterior = periodoAnterior(desde, hasta);

  const supabase = await createClient();

  const [{ data: pedidos }, { data: itemsVendidos }, { data: pedidosAnteriores }, { data: pedidosPendientes }] =
    await Promise.all([
      supabase
        .from("pedidos")
        .select("id, cliente_id, total, fecha_pedido, estado, clientes(nombre), vendedores(nombre)")
        .neq("estado", "cancelado")
        .neq("estado", "eliminado")
        .gte("fecha_pedido", desde)
        .lte("fecha_pedido", hasta),
      supabase
        .from("pedido_items")
        .select(
          "cantidad, precio_unitario, precio_lista, subtotal, productos(nombre, categoria, formato), pedidos!inner(fecha_pedido, estado, clientes(nombre))"
        )
        .neq("pedidos.estado", "cancelado")
        .neq("pedidos.estado", "eliminado")
        .gte("pedidos.fecha_pedido", desde)
        .lte("pedidos.fecha_pedido", hasta),
      supabase
        .from("pedidos")
        .select("total")
        .neq("estado", "cancelado")
        .neq("estado", "eliminado")
        .gte("fecha_pedido", anterior.desde)
        .lte("fecha_pedido", anterior.hasta),
      // Pendiente de pago = mismo criterio que "Por cobrar" en Cobranzas
      // (pedidos ya entregados que todavía no se marcan como pagados), pero
      // acotado al mismo rango de fechas (por fecha de pedido) que el resto
      // del reporte, para que todos los cuadros hablen del mismo período.
      supabase
        .from("pedidos")
        .select("id, total")
        .eq("estado", "entregado")
        .eq("pagado", false)
        .gte("fecha_pedido", desde)
        .lte("fecha_pedido", hasta),
    ]);

  const totalPeriodo = (pedidos ?? []).reduce((acc, p) => acc + Number(p.total), 0);
  const cantidadPedidos = (pedidos ?? []).length;
  const totalPeriodoAnterior = (pedidosAnteriores ?? []).reduce((acc, p) => acc + Number(p.total), 0);
  const cambio = formatCambio(totalPeriodo, totalPeriodoAnterior);

  const listaPendientes = pedidosPendientes ?? [];
  // Un pedido "sin pagar" puede tener abonos parciales ya registrados — se
  // descuentan para que este cuadro muestre el saldo real, igual que en
  // Cobranzas.
  const idsPendientes = listaPendientes.map((p) => p.id);
  const { data: abonosPendientes } =
    idsPendientes.length > 0
      ? await supabase.from("abonos_pedido").select("pedido_id, monto").in("pedido_id", idsPendientes)
      : { data: [] };
  const abonadoPorPedidoPendiente = new Map<string, number>();
  for (const a of abonosPendientes ?? []) {
    abonadoPorPedidoPendiente.set(
      a.pedido_id,
      (abonadoPorPedidoPendiente.get(a.pedido_id) ?? 0) + Number(a.monto)
    );
  }
  const totalPendienteCobro = listaPendientes.reduce(
    (acc, p) => acc + Math.max(0, Number(p.total) - (abonadoPorPedidoPendiente.get(p.id) ?? 0)),
    0
  );

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
      (item as unknown as { productos: { nombre: string } | null }).productos?.nombre ?? "Producto";
    const actual = porProducto.get(nombre) ?? { cantidad: 0, total: 0 };
    actual.cantidad += item.cantidad;
    actual.total += Number(item.subtotal);
    porProducto.set(nombre, actual);
  }

  // Ranking de clientes por volumen (total comprado) y frecuencia (cantidad
  // de pedidos) en el período. Se agrupa por cliente_id, no por nombre, para
  // no mezclar dos clientes que por casualidad se llamen igual.
  const porCliente = new Map<string, { nombre: string; total: number; pedidos: number }>();
  for (const p of pedidos ?? []) {
    const clienteId = p.cliente_id as string;
    const nombre =
      (p as unknown as { clientes: { nombre: string } | null }).clientes?.nombre ?? "Cliente";
    const actual = porCliente.get(clienteId) ?? { nombre, total: 0, pedidos: 0 };
    actual.total += Number(p.total);
    actual.pedidos += 1;
    porCliente.set(clienteId, actual);
  }
  const rankingClientes = [...porCliente.values()].sort((a, b) => b.total - a.total);

  // Producto más vendido dentro de cada categoría (tamaño), para saber qué
  // formato se mueve más en cada una.
  const porCategoriaProducto = new Map
    Categoria,
    Map<string, { formato: Formato; cantidad: number; total: number }>
  >();
  for (const item of itemsVendidos ?? []) {
    const producto = (
      item as unknown as {
        productos: { nombre: string; categoria: Categoria; formato: Formato } | null;
      }
    ).productos;
    if (!producto) continue;
    const mapaProductos = porCategoriaProducto.get(producto.categoria) ?? new Map();
    const actual = mapaProductos.get(producto.nombre) ?? {
      formato: producto.formato,
      cantidad: 0,
      total: 0,
    };
    actual.cantidad += item.cantidad;
    actual.total += Number(item.subtotal);
    mapaProductos.set(producto.nombre, actual);
    porCategoriaProducto.set(producto.categoria, mapaProductos);
  }
  const masVendidoPorCategoria = CATEGORIAS_ORDENADAS.map((categoria) => {
    const productos = porCategoriaProducto.get(categoria);
    if (!productos || productos.size === 0) return { categoria, top: null };
    const [nombre, datos] = [...productos.entries()].sort((a, b) => b[1].cantidad - a[1].cantidad)[0];
    return { categoria, top: { nombre, ...datos } };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Reportes de ventas</h1>
        <p className="text-sm text-stone-500">No incluye pedidos cancelados ni eliminados</p>
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total vendido" value={formatCLP(totalPeriodo)} hint={`${desde} a ${hasta}`} />
        <StatCard
          label="Pendiente de pago"
          value={formatCLP(totalPendienteCobro)}
          tone={listaPendientes.length > 0 ? "warning" : "default"}
          hint={`${listaPendientes.length} pedido${listaPendientes.length === 1 ? "" : "s"} sin pagar en el período`}
        />
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

      <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm">
        <span className="text-stone-500">
          Comparado con el período anterior ({anterior.desde} a {anterior.hasta}):{" "}
        </span>
        <span className={`font-semibold ${cambio.clase}`}>{cambio.texto}</span>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-stone-700">Ranking de clientes</p>
          <div className="divide-y divide-stone-100">
            {rankingClientes.map((c, i) => (
              <div key={c.nombre + i} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2 text-stone-600">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-500">
                    {i + 1}
                  </span>
                  {c.nombre}
                  <span className="text-xs text-stone-400">
                    ({c.pedidos} pedido{c.pedidos === 1 ? "" : "s"})
                  </span>
                </span>
                <span className="font-medium text-stone-800">{formatCLP(c.total)}</span>
              </div>
            ))}
            {rankingClientes.length === 0 && (
              <p className="py-4 text-center text-sm text-stone-400">Sin datos</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-stone-700">Más vendido por categoría</p>
          <div className="divide-y divide-stone-100">
            {masVendidoPorCategoria.map(({ categoria, top }) => (
              <div key={categoria} className="py-2 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  {NOMBRES_CATEGORIA[categoria]}
                </p>
                {top ? (
                  <div className="flex items-center justify-between">
                    <span className="text-stone-700">
                      {top.nombre}{" "}
                      <span className="text-xs text-stone-400">({NOMBRES_FORMATO[top.formato]})</span>
                    </span>
                    <span className="font-medium text-stone-800">{top.cantidad} un.</span>
                  </div>
                ) : (
                  <p className="text-stone-400">Sin ventas en el período</p>
                )}
              </div>
            ))}
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
