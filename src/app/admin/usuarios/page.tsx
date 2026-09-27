import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/roles";
import RolSelector from "@/components/RolSelector";
import ActivoToggle from "@/components/ActivoToggle";
import CrearUsuarioForm from "@/components/CrearUsuarioForm";
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-stone-800">Usuarios</h1>
          <p className="text-sm text-stone-500">
            Perfil de acceso de cada persona con cuenta en el sistema
          </p>
        </div>
        <CrearUsuarioForm />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Estado</th>
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
                  <td className="px-4 py-3">
                    <ActivoToggle vendedorId={v.id} activo={v.activo} disabled={esUnoMismo} />
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-stone-400">
                    {esUnoMismo ? "No puedes editar tu propia cuenta" : ""}
                  </td>
                </tr>
              );
            })}
            {lista.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-stone-400">
                  Aún no hay usuarios registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-stone-400">
        Una persona dada de baja no puede volver a entrar al sistema hasta que se le dé de alta
        de nuevo.
      </p>
    </div>
  );
}
