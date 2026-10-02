"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hoyChile } from "@/lib/format";

// Registrar un costo (luz, agua, sueldos, insumos, etc.). La categoría es
// una de las guardadas en categorias_costo — el usuario las administra
// desde esta misma página.
export async function registrarCosto(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const categoriaId = String(formData.get("categoria_id") ?? "").trim();
  const monto = Number(formData.get("monto"));
  const proveedor = String(formData.get("proveedor") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim();
  const fechaInput = String(formData.get("fecha") ?? "").trim();
  const fecha = fechaInput || hoyChile();

  if (!categoriaId || !monto || monto <= 0) {
    redirect("/admin/costos");
  }

  await supabase.from("costos").insert({
    fecha,
    categoria_id: categoriaId,
    monto,
    proveedor: proveedor || null,
    notas: notas || null,
    vendedor_id: user?.id ?? null,
  });

  revalidatePath("/admin/costos");
  revalidatePath("/admin/reportes");
  redirect("/admin/costos?ok=1");
}

// Editar un registro de costo ya existente. A diferencia de las compras de
// alimento, un costo no mueve stock ni ningún otro saldo — es solo un
// registro de gasto — así que editarlo es un simple update, sin tener que
// "revertir" ni reasentar nada.
export async function editarCosto(id: string, formData: FormData) {
  const supabase = await createClient();

  const fecha = String(formData.get("fecha") ?? "").trim();
  const categoriaId = String(formData.get("categoria_id") ?? "").trim();
  const monto = Number(formData.get("monto"));
  const proveedor = String(formData.get("proveedor") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim();

  if (!fecha || !categoriaId || !monto || monto <= 0) {
    redirect(`/admin/costos/${id}/editar`);
  }

  await supabase
    .from("costos")
    .update({
      fecha,
      categoria_id: categoriaId,
      monto,
      proveedor: proveedor || null,
      notas: notas || null,
    })
    .eq("id", id);

  revalidatePath("/admin/costos");
  revalidatePath("/admin/reportes");
  redirect("/admin/costos?editOk=1");
}

// Eliminar un registro de costo — sin restricciones más allá del rol (la
// base de datos ya solo deja tocar esta tabla a un administrador). No hay
// "reversa" de stock que hacer, a diferencia de las compras de alimento:
// esto es solo un registro de gasto.
export async function eliminarCosto(id: string) {
  const supabase = await createClient();
  await supabase.from("costos").delete().eq("id", id);
  revalidatePath("/admin/costos");
  revalidatePath("/admin/reportes");
}

// Crear una categoría de costo nueva. El nombre es único — si ya existe,
// se avisa en la página en vez de fallar en silencio.
export async function crearCategoriaCosto(formData: FormData) {
  const supabase = await createClient();
  const nombre = String(formData.get("nombre") ?? "").trim();

  if (!nombre) {
    redirect("/admin/costos");
  }

  const { error } = await supabase.from("categorias_costo").insert({ nombre });

  revalidatePath("/admin/costos");
  redirect(error ? "/admin/costos?errorCategoria=1" : "/admin/costos?catOk=1");
}

// Renombrar una categoría existente — los costos ya registrados con ella
// quedan igual (solo cambia el nombre que se les muestra).
export async function renombrarCategoriaCosto(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();

  if (!id || !nombre) {
    redirect("/admin/costos");
  }

  const { error } = await supabase.from("categorias_costo").update({ nombre }).eq("id", id);

  revalidatePath("/admin/costos");
  revalidatePath("/admin/reportes");
  redirect(error ? "/admin/costos?errorCategoria=1" : "/admin/costos?catOk=1");
}

// Eliminar una categoría de costo. La base de datos lo bloquea (on delete
// restrict) si todavía tiene costos registrados con ella — en vez de dejar
// que ese error crudo llegue al usuario, se devuelve un mensaje claro para
// que el botón (un componente cliente) lo muestre con window.alert.
export async function eliminarCategoriaCosto(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("categorias_costo").delete().eq("id", id);

  revalidatePath("/admin/costos");

  if (error) {
    return {
      ok: false,
      error: "No se puede eliminar: todavía tiene costos registrados en esta categoría.",
    };
  }
  return { ok: true };
}
