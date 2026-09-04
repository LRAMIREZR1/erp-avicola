import { createClient } from "@/lib/supabase/server";
import PedidoForm from "@/components/PedidoForm";

export default async function NuevoPedidoPage() {
  const supabase = await createClient();
  const [clientes, productos] = await Promise.all([
    supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
    supabase.from("productos").select("*").eq("activo", true).order("categoria"),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-stone-800">Nuevo pedido</h1>
      <PedidoForm clientes={clientes.data ?? []} productos={productos.data ?? []} />
    </div>
  );
}
