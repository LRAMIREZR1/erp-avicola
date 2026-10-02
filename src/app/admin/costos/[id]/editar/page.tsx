import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/roles";
import { editarCosto } from "@/app/admin/costos/actions";
import BotonEnviar from "@/components/BotonEnviar";

interface CategoriaCosto {
  id: string;
  nombre: string;
}

export default async function EditarCostoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRol(["administrador"]);
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: costo }, { data: categorias }] = await Promise.all([
    supabase
      .from("costos")
      .select("id, fecha, categoria_id, monto, proveedor, notas")
      .eq("id", id)
      .single(),
    supabase.from("categorias_costo").select("id, nombre").order("nombre", { ascending: true }),
  ]);

  if (!costo) notFound();

  const listaCategorias = (categorias ?? []) as CategoriaCosto[];

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Editar costo</h1>
        <p className="text-sm text-stone-500">Corrige los datos de este registro de gasto</p>
      </div>

      <form
        action={editarCosto.bind(null, costo.id)}
        className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4"
      >
        <div>
          <label htmlFor="fecha" className="mb-1 block text-sm font-medium text-stone-800">
            Fecha
          </label>
          <input
            id="fecha"
            type="date"
            name="fecha"
            defaultValue={costo.fecha}
            required
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="categoria_id" className="mb-1 block text-sm font-medium text-stone-800">
            Categoría
          </label>
          <select
            id="categoria_id"
            name="categoria_id"
            defaultValue={costo.categoria_id}
            required
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
          >
            {listaCategorias.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="monto" className="mb-1 block text-sm font-medium text-stone-800">
            Monto
          </label>
          <input
            id="monto"
            type="number"
            name="monto"
            min={1}
            defaultValue={costo.monto}
            required
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="proveedor" className="mb-1 block text-sm font-medium text-stone-800">
            A quién se le pagó (opcional)
          </label>
          <input
            id="proveedor"
            type="text"
            name="proveedor"
            defaultValue={costo.proveedor ?? ""}
            placeholder="Ej: Enel, trabajador, ferretería"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="notas" className="mb-1 block text-sm font-medium text-stone-800">
            Notas (opcional)
          </label>
          <input
            id="notas"
            type="text"
            name="notas"
            defaultValue={costo.notas ?? ""}
            placeholder="Ej: boleta 1234"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-4 pt-2">
          <BotonEnviar
            pendingLabel="Guardando..."
            className="rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
          >
            Guardar cambios
          </BotonEnviar>
          <Link href="/admin/costos" className="text-sm font-medium text-stone-600 hover:underline">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
