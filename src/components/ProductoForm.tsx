import type { Producto } from "@/lib/supabase/types";
import { guardarProducto } from "@/app/admin/productos/actions";

export default function ProductoForm({ producto }: { producto?: Producto }) {
  return (
    <form action={guardarProducto} className="max-w-lg space-y-4">
      {producto && <input type="hidden" name="id" value={producto.id} />}

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Nombre *</label>
        <input
          name="nombre"
          required
          defaultValue={producto?.nombre}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
          placeholder="Huevo Extra - Bandeja 30"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Categoría *</label>
        <select
          name="categoria"
          defaultValue={producto?.categoria ?? "primera"}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
        >
          <option value="segunda">Segunda</option>
          <option value="primera">Primera</option>
          <option value="extra">Extra</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Formato *</label>
        <select
          name="formato"
          defaultValue={producto?.formato ?? "bandeja_30"}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
        >
          <option value="bandeja_30">Bandeja de 30</option>
          <option value="caja_120">Caja de 120</option>
          <option value="caja_180">Caja de 180</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Precio (CLP) *</label>
        <input
          type="number"
          name="precio"
          min={0}
          required
          defaultValue={producto?.precio}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">
          Stock mínimo (para alertas)
        </label>
        <input
          type="number"
          name="stock_minimo"
          min={0}
          defaultValue={producto?.stock_minimo ?? 0}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
      >
        Guardar producto
      </button>
    </form>
  );
}
