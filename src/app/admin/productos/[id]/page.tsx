import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProductoForm from "@/components/ProductoForm";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: producto } = await supabase.from("productos").select("*").eq("id", id).single();

  if (!producto) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-stone-800">Editar producto</h1>
      <ProductoForm producto={producto} />
    </div>
  );
}
