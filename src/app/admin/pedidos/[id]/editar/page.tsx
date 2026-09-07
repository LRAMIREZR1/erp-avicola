import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PedidoForm from "@/components/PedidoForm";
import { requireRol } from "@/lib/roles";

export default async function EditarPedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const rol = await requireRol(["administrador", "vendedor"]);
  const { id } = await params;
  const supabase = await createClient();

  const [pedidoRes, itemsRes, clientesRes, productosRes] = await Promise.all([
    supabase
      .from("pedidos")
      .select("id, estado, cliente_id, fecha_entrega, notas, motivo_descuento")
      .eq("id", id)
      .single(),
    supabase
      .from("pedido_items")
      .select("producto_id, cantidad, precio_unitario, precio_lista")
      .eq("pedido_id", id),
    supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
    supabase.from("productos").select("*").eq("activo", true).order("categoria"),
  ]);

  if (!pedidoRes.data) notFound();

  if (rol === "vendedor" && pedidoRes.data.estado !== "pendiente") {
    redirect(`/admin/pedidos/${id}`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-stone-800">Editar pedido</h1>
      <PedidoForm
        clientes={clientesRes.data ?? []}
        productos={productosRes.data ?? []}
        modo="editar"
        pedidoId={id}
        valoresIniciales={{
          cliente_id: pedidoRes.data.cliente_id,
          fecha_entrega: pedidoRes.data.fecha_entrega,
          notas: pedidoRes.data.notas,
          motivo_descuento: pedidoRes.data.motivo_descuento,
          items: (itemsRes.data ?? []).map((i) => ({
            ...i,
            precio_lista: i.precio_lista ?? i.precio_unitario,
          })),
        }}
      />
    </div>
  );
}
