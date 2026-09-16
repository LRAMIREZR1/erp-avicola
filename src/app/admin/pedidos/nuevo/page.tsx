import { createClient } from "@/lib/supabase/server";
import PedidoForm from "@/components/PedidoForm";
import { requireRol } from "@/lib/roles";

export default async function NuevoPedidoPage() {
  const rol = await requireRol(["administrador", "vendedor"]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [clientes, productos, vendedores] = await Promise.all([
    supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
    supabase.from("productos").select("*").eq("activo", true).order("categoria"),
    // Solo se usa si es administrador (para poder asignar el pedido a otro
    // vendedor); igual se pide siempre por simplicidad, es una lista chica.
    supabase
      .from("vendedores")
      .select("id, nombre")
      .eq("activo", true)
      .in("rol", ["administrador", "vendedor"])
      .order("nombre"),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-stone-800">Nuevo pedido</h1>
      <PedidoForm
        clientes={clientes.data ?? []}
        productos={productos.data ?? []}
        rol={rol}
        vendedores={(vendedores.data ?? []).filter((v) => v.id !== user?.id)}
      />
    </div>
  );
}
