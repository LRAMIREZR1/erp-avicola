import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCLP, formatFechaHora } from "@/lib/format";
import { requireRol } from "@/lib/roles";
import BorrarHistorialPrecioButton from "@/components/BorrarHistorialPrecioButton";

export default async function HistorialPreciosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRol(["administrador"]);
  const { id } = await params;
  const supabase = await createClient();

  const [productoRes, historialRes] = await Promise.all([
    supabase.from("productos").select("id, nombre, precio").eq("id", id).single(),
    supabase
      .from("historial_precios")
      .select("id, precio_anterior, precio_nuevo, created_at, vendedores(nombre)")
      .eq("producto_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!productoRes.data) notFound();
  const producto = productoRes.data;
  const historial = historialRes.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/admin/productos/${id}`}
          className="text-sm text-amber-700 hover:underline"
        >
          ← Volver a {producto.nombre}
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-stone-800">
          Historial de precios — {producto.nombre}
        </h1>
        <p className="text-sm text-stone-500">Precio actual: {formatCLP(producto.precio)}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-200 text-xs font-semibold uppercase tracking-wide text-stone-600">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Precio anterior</th>
              <th className="px-4 py-3">Precio nuevo</th>
              <th className="px-4 py-3">Cambiado por</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {historial.map((h) => (
              <tr key={h.id}>
                <td className="px-4 py-3 text-stone-600">
                  {formatFechaHora(h.created_at)}
                </td>
                <td className="px-4 py-3 text-stone-600">
                  {formatCLP(Number(h.precio_anterior))}
                </td>
                <td className="px-4 py-3 font-medium text-stone-800">
                  {formatCLP(Number(h.precio_nuevo))}
                </td>
                <td className="px-4 py-3 text-stone-600">
                  {(h as unknown as { vendedores: { nombre: string } | null }).vendedores
                    ?.nombre ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <BorrarHistorialPrecioButton historialId={h.id} productoId={id} />
                </td>
              </tr>
            ))}
            {historial.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                  Aún no hay cambios de precio registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
