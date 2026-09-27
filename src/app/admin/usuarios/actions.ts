"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRol } from "@/lib/roles";
import type { Rol } from "@/lib/supabase/types";

export async function cambiarRolUsuario(vendedorId: string, rol: Rol) {
  "use server";
  const supabase = await createClient();

  const { error } = await supabase.from("vendedores").update({ rol }).eq("id", vendedorId);

  if (error) {
    throw new Error("No se pudo cambiar el perfil: " + error.message);
  }

  revalidatePath("/admin/usuarios");
}

// Activa o desactiva una cuenta. Una cuenta desactivada (activo = false) no
// puede seguir usando el sistema: el middleware la cierra sesión apenas
// intenta entrar a /admin (ver src/lib/supabase/middleware.ts).
export async function cambiarActivoUsuario(vendedorId: string, activo: boolean) {
  "use server";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id === vendedorId && !activo) {
    throw new Error("No puedes dar de baja tu propia cuenta.");
  }

  const { error } = await supabase.from("vendedores").update({ activo }).eq("id", vendedorId);

  if (error) {
    throw new Error("No se pudo actualizar el estado: " + error.message);
  }

  revalidatePath("/admin/usuarios");
}

// Crea una cuenta nueva de punta a punta: usuario en auth.users (vía Admin
// API, con contraseña ya definida) + su fila en vendedores (la crea sola un
// trigger — ver 0001_init.sql handle_new_user() — con rol "vendedor" por
// defecto, así que si se pidió otro rol se ajusta después).
//
// Devuelve un objeto en vez de lanzar una excepción para que el formulario
// pueda mostrar el error sin romper la página (a diferencia de las acciones
// de arriba, acá hay mucho más margen de error: correo repetido, contraseña
// corta, falta la service key, etc.).
export async function crearUsuario(datos: {
  nombre: string;
  email: string;
  password: string;
  rol: Rol;
}): Promise<{ error: string } | { ok: true }> {
  "use server";
  // Único usuario que puede crear cuentas. Este chequeo es la barrera real:
  // el cliente de administración de abajo se salta RLS por completo, así que
  // sin esto cualquiera que llame la acción podría crear usuarios.
  await requireRol(["administrador"]);

  const nombre = datos.nombre.trim();
  const email = datos.email.trim().toLowerCase();
  const password = datos.password;

  if (!nombre || !email) {
    return { error: "Nombre y correo son obligatorios." };
  }
  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falta configurar la conexión de administración.",
    };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  });

  if (error) {
    return {
      error: error.message.toLowerCase().includes("already")
        ? "Ya existe un usuario con ese correo."
        : "No se pudo crear el usuario: " + error.message,
    };
  }

  const nuevoId = data.user?.id;
  if (nuevoId && datos.rol !== "vendedor") {
    const { error: errorRol } = await admin
      .from("vendedores")
      .update({ rol: datos.rol })
      .eq("id", nuevoId);
    if (errorRol) {
      return {
        error: "El usuario se creó, pero no se pudo asignar el perfil: " + errorRol.message,
      };
    }
  }

  revalidatePath("/admin/usuarios");
  return { ok: true };
}

// Cambia la contraseña de cualquier usuario (incluido el propio admin que la
// ejecuta) vía Admin API — no depende de que Supabase tenga el envío de
// correos configurado, como sí lo necesitaría un "olvidé mi contraseña".
export async function cambiarPasswordUsuario(
  vendedorId: string,
  password: string
): Promise<{ error: string } | { ok: true }> {
  "use server";
  await requireRol(["administrador"]);

  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falta configurar la conexión de administración.",
    };
  }

  const { error } = await admin.auth.admin.updateUserById(vendedorId, { password });

  if (error) {
    return { error: "No se pudo cambiar la contraseña: " + error.message };
  }

  return { ok: true };
}
