import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCLP } from "@/lib/format";
import {
  NOMBRES_CATEGORIA,
  NOMBRES_FORMATO,
  type Categoria,
  type Formato,
  type Producto,
  type Rol,
} from "@/lib/supabase/types";
import { ajustarStock, desactivarProducto } from "@/app/admin/productos/actions";
import { requireRol } from "@/lib/roles";
import StockFisicoChart, { type StockFisicoDatum } from "@/components/StockFisicoChart";

// Orden por tamaño del huevo, de mayor a menor — no alfabético.
const ORDEN_CATEGORIA: Record<Categoria, number> = {
  super_extra: 0,
  extra: 1,
  primera: 2,
  segunda: 3,
  tercera: 4,
};

function TablaProductos({
  productos,
  mostrarFormato,
  rol,
}: {
  productos: Producto[];
  mostrarFormato: boolean;
  rol: Rol;
}) {
  const puedeAjustarStock = rol === "administrador" || rol === "encargado_bodega";
  const puedeEditar = rol === "administrador";

  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-stone-200 text-xs font-semibold uppercase tracking-wide text-stone-600">
          <tr>
            <th className="min-w-56 px-4 py-3">Producto</th>
            <th className="min-w-36 px-4 py-3">Categoría</th>
            {mostrarFormato && <th className="min-w-32 px-4 py-3">Formato</th>}
            <th className="min-w-28 px-4 py-3">Precio</th>
            <th className="min-w-32 px-4 py-3">Stock</th>
            {puedeAjustarStock && <th className="min-w-60 px-4 py-3">Ajustar stock</th>}
            {puedeEditar && <th className="min-w-36 px-4 py-3"></th>}
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
              <td className="px-4 py-3 text-stone-600">{formatCLP(p.precio)}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    p.stock_actual <= p.stock_minimo
                      ? "font-semibold text-red-600"
                      : "text-stone-700"
                  }
                >
                  {p.stock_actual}
                </span>
                <span className="text-stone-400"> / mín {p.stock_minimo}</span>
              </td>
              {puedeAjustarStock && (
                <td className="px-4 py-3">
                  <form action={ajustarStock} className="flex items-center gap-1">
                    <input type="hidden" name="producto_id" value={p.id} />
                    <input
                      type="number"
                      name="cantidad"
                      placeholder="+/-"
                      className="w-16 rounded-lg border border-stone-300 px-2 py-1 text-sm"
                    />
                    <select
                      name="motivo"
                      defaultValue="Ajuste manual"
                      className="rounded-lg border border-stone-300 px-1 py-1 text-xs text-stone-600"
                    >
                      <option value="Ajuste manual">Ajuste</option>
                      <option value="Merma / quiebre">Merma</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-200"
                    >
                      Aplicar
                    </button>
                  </form>
                </td>
              )}
              {puedeEditar && (
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <Link href={`/admin/productos/${p.id}`} className="text-amber-700 hover:underline">
                      Editar
                    </Link>
                    <form action={desactivarProducto.bind(null, p.id)}>
                      <button type="submit" className="text-stone-400 hover:text-red-600">
                        Desactivar
                      </button>
                    </form>
                  </div>
                </td>
              )}
            </tr>
          ))}
          {productos.length === 0 && (
            <tr>
              <td
                colSpan={4 + (mostrarFormato ? 1 : 0) + (puedeAjustarStock ? 1 : 0) + (puedeEditar ? 1 : 0)}
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

export default async function ProductosPage() {
  const rol = await requireRol(["administrador", "vendedor", "encargado_bodega"]);
  const supabase = await createClient();
  const puedeVerStockFisico = rol === "administrador" || rol === "encargado_bodega";

  const [{ data: productos }, { data: itemsReservados }] = await Promise.all([
    supabase.from("productos").select("*").eq("activo", true),
    // El gráfico de stock físico es para administrador y encargado de
    // bodega — el vendedor no lo ve aquí, así que no vale la pena pedirlo.
    puedeVerStockFisico
      ? supabase
          .from("pedido_items")
          .select("cantidad, productos(categoria, formato), pedidos!inner(estado)")
          .in("pedidos.estado", ["confirmado", "en_preparacion"])
      : Promise.resolve({ data: [] as { cantidad: number; productos: unknown }[] }),
  ]);

  const todos = [...(productos ?? [])].sort((a, b) => {
    const diff =
      ORDEN_CATEGORIA[a.categoria as Categoria] - ORDEN_CATEGORIA[b.categoria as Categoria];
    if (diff !== 0) return diff;
    return a.nombre.localeCompare(b.nombre);
  });
  const bandejas = todos.filter((p) => p.formato === "bandeja_30");
  const cajas = todos.filter((p) => p.formato !== "bandeja_30");

  // Disponible (stock_actual) agrupado por categoría, igual que en el
  // Resumen, para poder sumarle lo reservado y armar el gráfico de físico.
  const disponiblePorCategoria = new Map<string, { bandejas: number; cajas: number }>();
  for (const p of todos) {
    const nombreCategoria = NOMBRES_CATEGORIA[p.categoria as Categoria];
    const actual = disponiblePorCategoria.get(nombreCategoria) ?? { bandejas: 0, cajas: 0 };
    if (p.formato === "bandeja_30") {
      actual.bandejas += p.stock_actual;
    } else {
      actual.cajas += p.stock_actual;
    }
    disponiblePorCategoria.set(nombreCategoria, actual);
  }

  // Reservado = comprometido en pedidos confirmados/en preparación que aún
  // no llegan a "entregado": ya se descontó de "disponible", pero las cajas
  // siguen físicamente en la bodega hasta que se despachan.
  const reservadoPorCategoria = new Map<string, { bandejas: number; cajas: number }>();
  for (const item of itemsReservados ?? []) {
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

  const datosGraficoFisico: StockFisicoDatum[] = [...disponiblePorCategoria.entries()].map(
    ([categoria, disponible]) => {
      const reservado = reservadoPorCategoria.get(categoria) ?? { bandejas: 0, cajas: 0 };
      return {
        categoria,
        bandejasDisponible: disponible.bandejas,
        bandejasReservado: reservado.bandejas,
        cajasDisponible: disponible.cajas,
        cajasReservado: reservado.cajas,
      };
    }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-stone-800">Productos y stock</h1>
          <p className="text-sm text-stone-500">
            Categorías Super Extra / Extra / Primera / Segunda / Tercera, divididas por formato de
            venta
          </p>
          <p className="text-xs text-stone-400">
            Al ajustar stock, elige &quot;Merma&quot; cuando la pérdida es por huevos rotos —
            así queda separada de otros ajustes en el historial de stock.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(rol === "administrador" || rol === "encargado_bodega") && (
            <Link
              href="/admin/productos/movimientos"
              className="text-sm text-amber-700 hover:underline"
            >
              Ver historial de stock
            </Link>
          )}
          {rol === "administrador" && (
            <Link
              href="/admin/productos/nuevo"
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
            >
              + Nuevo producto
            </Link>
          )}
        </div>
      </div>

      {puedeVerStockFisico && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="mb-3">
            <p className="text-sm font-medium text-stone-700">Stock físico en bodega</p>
            <p className="text-xs text-stone-400">
              Incluye lo reservado en pedidos confirmados que aún no se despachan
            </p>
          </div>
          {datosGraficoFisico.length > 0 ? (
            <StockFisicoChart data={datosGraficoFisico} />
          ) : (
            <p className="py-4 text-center text-sm text-stone-400">Aún no hay productos</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-700">Bandejas (30 un.)</h2>
        <TablaProductos productos={bandejas} mostrarFormato={false} rol={rol} />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-700">Cajas (120 / 180 un.)</h2>
        <TablaProductos productos={cajas} mostrarFormato={true} rol={rol} />
      </div>
    </div>
  );
}
