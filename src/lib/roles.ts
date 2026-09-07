import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Rol } from "@/lib/supabase/types";

// Página de aterrizaje por defecto de cada perfil (a dónde mandarlo si intenta
// entrar a una sección que no le corresponde).
export const HOME_POR_ROL: Record<Rol, string> = {
  administrador: "/admin",
  vendedor: "/admin",
  encargado_bodega: "/admin/productos",
  repartidor: "/admin/reparto",
};

export async function obtenerRolActual(): Promise<Rol | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase.from("vendedores").select("rol").eq("id", user.id).single();
  return (data?.rol as Rol | undefined) ?? null;
}

// Llamar al inicio de una página de servidor protegida. Si el rol actual no
// está en la lista permitida, redirige a la página de inicio de su propio
// perfil (nunca deja la página renderizar con datos a medias).
export async function requireRol(rolesPermitidos: Rol[]): Promise<Rol> {
  const rol = await obtenerRolActual();

  if (!rol || !rolesPermitidos.includes(rol)) {
    redirect(HOME_POR_ROL[rol ?? "vendedor"]);
  }

  return rol;
}
