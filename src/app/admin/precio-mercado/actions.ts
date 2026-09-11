"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/roles";
import { hoyChile } from "@/lib/format";

// Registra un precio de mercado "escuchado" ese día (de otra avícola, un
// distribuidor o un comprador). No hay validación cruzada posible — es
// información de boca en boca, así que se guarda tal cual se ingresa.
export async function registrarPrecioMercado(formData: FormData) {
  await requireRol(["administrador", "vendedor"]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const fecha = String(formData.get("fecha") || hoyChile());
  const zona = String(formData.get("zona") || "");
  const categoria = String(formData.get("categoria") || "").trim();
  const unidad = String(formData.get("unidad") || "kilo");
  const precio = Number(formData.get("precio"));
  const fuente = String(formData.get("fuente") || "").trim();
  const nota = String(formData.get("nota") || "").trim();

  if (!zona || !precio || precio <= 0) {
    redirect("/admin/precio-mercado");
  }

  await supabase.from("precios_mercado").insert({
    fecha,
    zona,
    categoria: categoria || null,
    unidad,
    precio,
    fuente: fuente || null,
    nota: nota || null,
    vendedor_id: user?.id ?? null,
  });

  revalidatePath("/admin/precio-mercado");
  redirect("/admin/precio-mercado?ok=1");
}

export async function eliminarPrecioMercado(id: string) {
  await requireRol(["administrador"]);
  const supabase = await createClient();
  await supabase.from("precios_mercado").delete().eq("id", id);
  revalidatePath("/admin/precio-mercado");
}

// Referencia semanal oficial de ODEPA (precio al consumidor, no mayorista).
// Se anota a mano cada semana — no existe una forma confiable de traerla
// automática (el portal de series históricas de ODEPA está dado de baja).
// Usa upsert por (semana_fecha, region) para poder corregir un número mal
// ingresado sin dejar filas duplicadas de la misma semana.
export async function registrarReferenciaOdepa(formData: FormData) {
  await requireRol(["administrador"]);
  const supabase = await createClient();

  const semanaFecha = String(formData.get("semana_fecha") || "");
  const region = String(formData.get("region") || "");
  const precio = Number(formData.get("precio_odepa"));
  const fuenteUrl = String(formData.get("fuente_url") || "").trim();

  if (!semanaFecha || !region || !precio || precio <= 0) {
    redirect("/admin/precio-mercado");
  }

  await supabase
    .from("precios_referencia_odepa")
    .upsert(
      { semana_fecha: semanaFecha, region, precio, fuente_url: fuenteUrl || null },
      { onConflict: "semana_fecha,region" },
    );

  revalidatePath("/admin/precio-mercado");
  redirect("/admin/precio-mercado?ok=2");
}

export async function eliminarReferenciaOdepa(id: string) {
  await requireRol(["administrador"]);
  const supabase = await createClient();
  await supabase.from("precios_referencia_odepa").delete().eq("id", id);
  revalidatePath("/admin/precio-mercado");
}
