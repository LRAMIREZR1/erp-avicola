import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClienteForm from "@/components/ClienteForm";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: cliente } = await supabase.from("clientes").select("*").eq("id", id).single();

  if (!cliente) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-stone-800">Editar cliente</h1>
      <ClienteForm cliente={cliente} />
    </div>
  );
}
