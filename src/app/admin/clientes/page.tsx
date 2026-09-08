import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { desactivarCliente, reactivarCliente } from "@/app/admin/clientes/actions";
import EliminarClienteButton from "@/components/EliminarClienteButton";
import { requireRol } from "@/lib/roles";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const rol = await requireRol(["administrador", "vendedor"]);
  const { estado } = await searchParams;
  const verInactivos = estado === "inactivos";

  const supabase = await createClient();
  const [clientesRes, pedidosRes] = await Promise.all([
    // Sin filtro por vendedor_id: la política RLS "clientes select" ya deja
    // pasar solo lo que le corresponde a cada rol (el administrador ve
    // todos; el vendedor, únicamente los que él mismo creó).
    supabase
      .from("clientes")
      .select("*, vendedores(nombre)")
      .eq("activo", !verInactivos)
      .order("nombre"),
    supabase.from("pedidos").select("cliente_id"),
  ]);

  const clientes = clientesRes.data ?? [];
  const pedidosPorCliente = new Map<string, number>();
  for (const p of pedidosRes.data ?? []) {
    pedidosPorCliente.set(p.cliente_id, (pedidosPorCliente.get(p.cliente_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-stone-800">Clientes</h1>
          <p className="text-sm text-stone-500">
            {rol === "administrador"
              ? "Clientes B2B y minoristas — de todos los vendedores"
              : "Tus clientes B2B y minoristas"}
          </p>
        </div>
        <Link
          href="/admin/clientes/nuevo"
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          + Nuevo cliente
        </Link>
      </div>

      <div className="flex gap-2">
        <Link
          href="/admin/clientes"
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !verInactivos
              ? "bg-amber-700 text-white"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          Activos
        </Link>
        <Link
          href="/admin/clientes?estado=inactivos"
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            verInactivos
              ? "bg-amber-700 text-white"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          Desactivados
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-200 text-xs font-semibold uppercase tracking-wide text-stone-600">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Zona de entrega</th>
              {rol === "administrador" && <th className="px-4 py-3">Vendedor</th>}
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {clientes.map((c) => {
              const tienePedidos = (pedidosPorCliente.get(c.id) ?? 0) > 0;
              return (
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
                  {rol === "administrador" && (
                    <td className="px-4 py-3 text-stone-600">
                      {(c as unknown as { vendedores: { nombre: string } | null }).vendedores
                        ?.nombre ?? "Sin asignar"}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/admin/clientes/${c.id}`}
                        className="text-amber-700 hover:underline"
                      >
                        Editar
                      </Link>
                      {c.activo ? (
                        <form action={desactivarCliente.bind(null, c.id)}>
                          <button type="submit" className="text-stone-400 hover:text-red-600">
                            Desactivar
                          </button>
                        </form>
                      ) : (
                        <form action={reactivarCliente.bind(null, c.id)}>
                          <button type="submit" className="text-stone-400 hover:text-green-700">
                            Reactivar
                          </button>
                        </form>
                      )}
                      {rol === "administrador" && !tienePedidos && (
                        <EliminarClienteButton clienteId={c.id} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {clientes.length === 0 && (
              <tr>
                <td
                  colSpan={rol === "administrador" ? 6 : 5}
                  className="px-4 py-8 text-center text-stone-400"
                >
                  {verInactivos
                    ? "No hay clientes desactivados"
                    : "Aún no hay clientes registrados"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
