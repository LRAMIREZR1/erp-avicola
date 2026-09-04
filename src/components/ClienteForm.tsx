import type { Cliente } from "@/lib/supabase/types";
import { guardarCliente } from "@/app/admin/clientes/actions";

export default function ClienteForm({ cliente }: { cliente?: Cliente }) {
  return (
    <form action={guardarCliente} className="max-w-lg space-y-4">
      {cliente && <input type="hidden" name="id" value={cliente.id} />}

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Nombre *</label>
        <input
          name="nombre"
          required
          defaultValue={cliente?.nombre}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
          placeholder="Hotel Plaza / Hospital Regional / Juan Pérez"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Tipo *</label>
        <select
          name="tipo"
          defaultValue={cliente?.tipo ?? "minorista"}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
        >
          <option value="b2b">B2B (hotel, hospital, gran volumen)</option>
          <option value="minorista">Minorista (bandejas)</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">
          Nombre de contacto
        </label>
        <input
          name="contacto_nombre"
          defaultValue={cliente?.contacto_nombre ?? ""}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">
          Teléfono / WhatsApp
        </label>
        <input
          name="telefono"
          defaultValue={cliente?.telefono ?? ""}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Dirección</label>
        <input
          name="direccion"
          defaultValue={cliente?.direccion ?? ""}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Zona de entrega</label>
        <input
          name="zona_entrega"
          defaultValue={cliente?.zona_entrega ?? ""}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
          placeholder="San Clemente centro, Talca, etc."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Notas</label>
        <textarea
          name="notas"
          defaultValue={cliente?.notas ?? ""}
          rows={3}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
      >
        Guardar cliente
      </button>
    </form>
  );
}
