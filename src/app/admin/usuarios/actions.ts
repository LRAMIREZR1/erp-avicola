"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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
