import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProductoForm from "@/components/ProductoForm";
import { requireRol } from "@/lib/roles";
import { formatCLP, formatFechaHora } from "@/lib/format";

interface HistorialPrecioReciente {
  id: string;
  precio_anterior: number;
  precio_nuevo: number;
  created_at: string;
  vendedores: { nombre: string } | null;
}

// Cuántos cambios recientes se muestran acá al lado del formulario — el
// historial completo (sin límite, y con opción de borrar entradas) sigue
// disponible en su propia pantalla vía el link de abajo.
const CANTIDAD_RECIENTES = 5;

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRol(["administrador"]);
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: producto }, { data: historialData }] = await Promise.all([
    supabase.from("productos").select("*").eq("id", id).single(),
    // El precio_anterior/nuevo lo llena solo un trigger de la base de datos
    // cada vez que cambia "precio" en productos (ver migración
    // 0020_historial_precios.sql) — acá solo se lee.
    supabase
      .from("historial_precios")
      .select("id, precio_anterior, precio_nuevo, created_at, vendedores(nombre)")
      .eq("producto_id", id)
      .order("created_at", { ascending: false })
      .limit(CANTIDAD_RECIENTES),
  ]);

  if (!producto) notFound();
  const historial = (historialData ?? []) as unknown as HistorialPrecioReciente[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Editar producto</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,28rem)_20rem] lg:items-start">
        <ProductoForm producto={producto} />

        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="mb-1 text-sm font-medium text-stone-700">Últimos precios</p>
          <p className="mb-3 text-xs text-stone-400">
            Precio actual: {formatCLP(producto.precio)}
          </p>

          {historial.length === 0 ? (
            <p className="py-4 text-center text-sm text-stone-400">
              Aún no hay cambios de precio registrados
            </p>
          ) : (
            <div className="divide-y divide-stone-100">
              {historial.map((h) => (
                <div key={h.id} className="py-2 text-sm">
                  <p className="text-stone-600">
                    {formatCLP(Number(h.precio_anterior))}{" "}
                    <span className="text-stone-400">→</span>{" "}
                    <span className="font-medium text-stone-800">
                      {formatCLP(Number(h.precio_nuevo))}
                    </span>
                  </p>
                  <p className="text-xs text-stone-400">
                    {formatFechaHora(h.created_at)}
                    {h.vendedores?.nombre ? ` · ${h.vendedores.nombre}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}

          <Link
            href={`/admin/productos/${id}/historial`}
            className="mt-3 inline-block text-sm text-amber-700 hover:underline"
          >
            Ver historial completo →
          </Link>
        </div>
      </div>
    </div>
  );
}
