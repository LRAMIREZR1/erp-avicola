import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProductoForm from "@/components/ProductoForm";
import { requireRol } from "@/lib/roles";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRol(["administrador"]);
  const { id } = await params;
  const supabase = await createClient();
  const { data: producto } = await supabase.from("productos").select("*").eq("id", id).single();

  if (!producto) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-stone-800">Editar producto</h1>
        <Link
          href={`/admin/productos/${id}/historial`}
          className="text-sm text-amber-700 hover:underline"
        >
          Ver historial de precios
        </Link>
      </div>
      <ProductoForm producto={producto} />
    </div>
  );
}
