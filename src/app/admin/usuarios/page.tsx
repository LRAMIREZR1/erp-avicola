import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/roles";
import RolSelector from "@/components/RolSelector";
import type { Rol } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  await requireRol(["administrador"]);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: vendedores } = await supabase
    .from("vendedores")
    .select("id, nombre, rol, activo")
    .order("nombre");

  const lista = vendedores ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Usuarios</h1>
        <p className="text-sm text-stone-500">
          Perfil de acceso de cada persona con cuenta en el sistema
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {lista.map((v) => {
              const esUnoMismo = v.id === user?.id;
              return (
                <tr key={v.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-800">
                    {v.nombre}
                    {!v.activo && <span className="ml-2 text-xs text-stone-400">(inactivo)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <RolSelector vendedorId={v.id} rol={v.rol as Rol} disabled={esUnoMismo} />
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-stone-400">
                    {esUnoMismo ? "No puedes cambiar tu propio perfil" : ""}
                  </td>
                </tr>
              );
            })}
            {lista.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-stone-400">
                  Aún no hay usuarios registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-stone-400">
        Cuando agregas a alguien nuevo en Supabase (Authentication → Users), se le crea
        automáticamente una cuenta interna con perfil &quot;Vendedor&quot; por defecto — cámbiaselo
        aquí si le corresponde otro perfil.
      </p>
    </div>
  );
}
