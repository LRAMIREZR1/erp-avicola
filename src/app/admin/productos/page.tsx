import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCLP } from "@/lib/format";
import {
  NOMBRES_CATEGORIA,
  NOMBRES_FORMATO,
  type Categoria,
  type Formato,
} from "@/lib/supabase/types";
import { ajustarStock, desactivarProducto } from "@/app/admin/productos/actions";

export default async function ProductosPage() {
  const supabase = await createClient();
  const { data: productos } = await supabase
    .from("productos")
    .select("*")
    .eq("activo", true)
    .order("categoria");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-stone-800">Productos y stock</h1>
          <p className="text-sm text-stone-500">
            Categorías Segunda / Primera / Extra y formatos de venta
          </p>
        </div>
        <Link
          href="/admin/productos/nuevo"
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          + Nuevo producto
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Formato</th>
              <th className="px-4 py-3">Precio</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Ajustar stock</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {(productos ?? []).map((p) => (
              <tr key={p.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-medium text-stone-800">{p.nombre}</td>
                <td className="px-4 py-3 text-stone-600">
                  {NOMBRES_CATEGORIA[p.categoria as Categoria]}
                </td>
                <td className="px-4 py-3 text-stone-600">
                  {NOMBRES_FORMATO[p.formato as Formato]}
                </td>
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
                <td className="px-4 py-3">
                  <form action={ajustarStock} className="flex items-center gap-1">
                    <input type="hidden" name="producto_id" value={p.id} />
                    <input type="hidden" name="motivo" value="Ajuste manual" />
                    <input
                      type="number"
                      name="cantidad"
                      placeholder="+/-"
                      className="w-20 rounded-lg border border-stone-300 px-2 py-1 text-sm"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-200"
                    >
                      Aplicar
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/admin/productos/${p.id}`}
                      className="text-amber-700 hover:underline"
                    >
                      Editar
                    </Link>
                    <form action={desactivarProducto.bind(null, p.id)}>
                      <button type="submit" className="text-stone-400 hover:text-red-600">
                        Desactivar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {(productos ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                  Aún no hay productos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
