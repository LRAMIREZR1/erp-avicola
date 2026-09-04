"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TipoCliente } from "@/lib/supabase/types";

export async function guardarCliente(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id") as string | null;
  const payload = {
    nombre: String(formData.get("nombre") ?? "").trim(),
    tipo: formData.get("tipo") as TipoCliente,
    contacto_nombre: (formData.get("contacto_nombre") as string) || null,
    telefono: (formData.get("telefono") as string) || null,
    direccion: (formData.get("direccion") as string) || null,
    zona_entrega: (formData.get("zona_entrega") as string) || null,
    notas: (formData.get("notas") as string) || null,
  };

  if (!payload.nombre) {
    throw new Error("El nombre del cliente es obligatorio");
  }

  if (id) {
    await supabase.from("clientes").update(payload).eq("id", id);
  } else {
    await supabase.from("clientes").insert(payload);
  }

  revalidatePath("/admin/clientes");
  redirect("/admin/clientes");
}

export async function desactivarCliente(id: string) {
  "use server";
  const supabase = await createClient();
  await supabase.from("clientes").update({ activo: false }).eq("id", id);
  revalidatePath("/admin/clientes");
}
