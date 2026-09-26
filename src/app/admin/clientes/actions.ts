"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerRolActual } from "@/lib/roles";
import type { TipoCliente } from "@/lib/supabase/types";

export async function guardarCliente(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id") as string | null;
  // El mapa (MapaCliente.tsx) deja estos dos campos vacíos cuando todavía no
  // se ha ubicado un punto — en ese caso se guardan como null, no como 0.
  const latitudRaw = (formData.get("latitud") as string) || "";
  const longitudRaw = (formData.get("longitud") as string) || "";
  const payload = {
    nombre: String(formData.get("nombre") ?? "").trim(),
    tipo: formData.get("tipo") as TipoCliente,
    contacto_nombre: (formData.get("contacto_nombre") as string) || null,
    telefono: (formData.get("telefono") as string) || null,
    direccion: (formData.get("direccion") as string) || null,
    latitud: latitudRaw ? parseFloat(latitudRaw) : null,
    longitud: longitudRaw ? parseFloat(longitudRaw) : null,
    zona_entrega: (formData.get("zona_entrega") as string) || null,
    notas: (formData.get("notas") as string) || null,
  };

  if (!payload.nombre) {
    throw new Error("El nombre del cliente es obligatorio");
  }

  if (id) {
    // Al editar no se toca el dueño — un cliente ya asignado sigue siendo
    // de su vendedor (o sin dueño, si así estaba).
    await supabase.from("clientes").update(payload).eq("id", id);
  } else {
    // Si lo crea un vendedor, el cliente queda reservado para él (solo él
    // lo verá en su lista). Si lo crea el administrador, queda sin dueño —
    // y por eso ningún vendedor lo ve, solo el administrador.
    const rol = await obtenerRolActual();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const vendedorId = rol === "vendedor" ? (user?.id ?? null) : null;

    await supabase.from("clientes").insert({ ...payload, vendedor_id: vendedorId });
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

export async function reactivarCliente(id: string) {
  "use server";
  const supabase = await createClient();
  await supabase.from("clientes").update({ activo: true }).eq("id", id);
  revalidatePath("/admin/clientes");
}

// Borrado definitivo: solo se ofrece en la interfaz cuando el cliente no
// tiene ningún pedido asociado (la tabla pedidos no permite borrar un
// cliente que sí tiene pedidos, por la relación entre ambas tablas), así
// que en ese caso es seguro eliminarlo de verdad en vez de solo desactivarlo.
export async function eliminarCliente(id: string) {
  const supabase = await createClient();
  await supabase.from("clientes").delete().eq("id", id);
  revalidatePath("/admin/clientes");
}

// Creación rápida de cliente desde dentro del formulario de Pedido (o
// cualquier otro formulario), sin salir de esa pantalla. A diferencia de
// guardarCliente, no redirige: devuelve el cliente recién creado para que el
// formulario que la llamó lo agregue a su lista y lo deje seleccionado.
export async function crearClienteRapido(formData: FormData) {
  const supabase = await createClient();

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) {
    throw new Error("El nombre del cliente es obligatorio");
  }

  // Mismo criterio que guardarCliente: si lo crea un vendedor, queda
  // reservado para él; si lo crea el administrador, queda sin dueño (y por
  // eso ningún vendedor lo ve, solo el administrador).
  const rol = await obtenerRolActual();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const vendedorId = rol === "vendedor" ? (user?.id ?? null) : null;

  // Igual que en guardarCliente: el mapa deja estos campos vacíos cuando
  // todavía no se ha ubicado un punto — se guardan como null, no como 0.
  const latitudRaw = (formData.get("latitud") as string) || "";
  const longitudRaw = (formData.get("longitud") as string) || "";

  const payload = {
    nombre,
    tipo: (formData.get("tipo") as TipoCliente) || "minorista",
    telefono: (formData.get("telefono") as string) || null,
    direccion: (formData.get("direccion") as string) || null,
    latitud: latitudRaw ? parseFloat(latitudRaw) : null,
    longitud: longitudRaw ? parseFloat(longitudRaw) : null,
    zona_entrega: (formData.get("zona_entrega") as string) || null,
    vendedor_id: vendedorId,
  };

  const { data, error } = await supabase.from("clientes").insert(payload).select("*").single();

  if (error || !data) {
    throw new Error("No se pudo crear el cliente: " + error?.message);
  }

  // Ojo: a propósito NO se revalida la página de pedidos (ni "nueva" ni
  // "editar") acá. Esta acción se llama desde dentro del modal de un
  // pedido que sigue abierto en pantalla — si se revalida esa misma ruta,
  // Next.js dispara automáticamente un refresh de toda la página apenas
  // termina la acción, justo mientras el modal (con el mapa de Google
  // adentro) se está cerrando. Esa combinación fue la causa de que en el
  // celular la página se cayera ("This page couldn't load") al crear un
  // cliente nuevo desde un pedido. El formulario ya agrega el cliente
  // nuevo a su lista en memoria (ver PedidoForm), así que no hace falta
  // refrescar la página para verlo. /admin/clientes sí se revalida, para
  // que aparezca actualizado la próxima vez que se visite esa pantalla.
  revalidatePath("/admin/clientes");
  return data;
}
