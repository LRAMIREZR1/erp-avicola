import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { desactivarCliente } from "./actions";

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data: clientes } = await supabase
    .from("clientes")
    .select("*")
    .eq("activo", true)
    .order("nombre");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-stone-800">Clientes</h1>
          <p className="text-sm text-stone-500">Clientes B2B y minoristas</p>
        </div>
        <Link
          href="/admin/clientes/nuevo"
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          + Nuevo cliente
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Zona de entrega</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {(clientes ?? []).map((c) => (
              <tr key={c.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-medium text-stone-800">{c.nombre}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.tipo === "b2b"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-stone-100 text-stone-700"
                    }`}
                  >
                    {c.tipo === "b2b" ? "B2B" : "Minorista"}
                  </span>
                </td>
                <td className="px-4 py-3 text-stone-600">{c.telefono ?? "—"}</td>
                <td className="px-4 py-3 text-stone-600">{c.zona_entrega ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/admin/clientes/${c.id}`}
                      className="text-amber-700 hover:underline"
                    >
                      Editar
                    </Link>
                    <form action={desactivarCliente.bind(null, c.id)}>
                      <button type="submit" className="text-stone-400 hover:text-red-600">
                        Desactivar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {(clientes ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                  Aún no hay clientes registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
