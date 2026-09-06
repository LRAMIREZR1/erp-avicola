import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCLP, formatFecha } from "@/lib/format";
import EstadoSelector from "@/components/EstadoSelector";
import BorrarPedidoButton from "@/components/BorrarPedidoButton";

export default async function DetallePedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: pedido } = await supabase
    .from("pedidos")
    .select(
      "id, estado, total, fecha_pedido, fecha_entrega, notas, clientes(nombre, telefono, direccion, zona_entrega), vendedores(nombre)"
    )
    .eq("id", id)
    .single();

  if (!pedido) notFound();

  const { data: items } = await supabase
    .from("pedido_items")
    .select("id, cantidad, precio_unitario, subtotal, productos(nombre)")
    .eq("pedido_id", id);

  const cliente = (
    pedido as unknown as {
      clientes: {
        nombre: string;
        telefono: string | null;
        direccion: string | null;
        zona_entrega: string | null;
      } | null;
    }
  ).clientes;
  const vendedor = (pedido as unknown as { vendedores: { nombre: string } | null }).vendedores;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-stone-800">Pedido de {cliente?.nombre}</h1>
          <p className="text-sm text-stone-500">
            {formatFecha(pedido.fecha_pedido)} · Vendedor: {vendedor?.nombre ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <EstadoSelector pedidoId={pedido.id} estado={pedido.estado} />
          <Link
            href={`/admin/pedidos/${pedido.id}/editar`}
            className="text-xs font-medium text-amber-700 hover:underline"
          >
            Editar
          </Link>
          <BorrarPedidoButton pedidoId={pedido.id} />
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="mb-2 text-sm font-medium text-stone-700">Cliente</p>
        <div className="space-y-1 text-sm text-stone-600">
          <p>{cliente?.telefono ?? "Sin teléfono"}</p>
          <p>{cliente?.direccion ?? "Sin dirección"}</p>
          <p>{cliente?.zona_entrega ?? "Sin zona de entrega"}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-stone-700">Productos</p>
        <div className="divide-y divide-stone-100">
          {(items ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-stone-700">
                {(item as unknown as { productos: { nombre: string } | null }).productos
                  ?.nombre ?? "Producto"}{" "}
                × {item.cantidad}
              </span>
              <span className="text-stone-800">{formatCLP(Number(item.subtotal))}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-stone-200 pt-3">
          <span className="text-sm font-medium text-stone-700">Total</span>
          <span className="text-lg font-semibold text-stone-800">
            {formatCLP(Number(pedido.total))}
          </span>
        </div>
      </div>

      {pedido.notas && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="mb-1 text-sm font-medium text-stone-700">Notas</p>
          <p className="text-sm text-stone-600">{pedido.notas}</p>
        </div>
      )}

      {pedido.fecha_entrega && (
        <p className="text-sm text-stone-500">
          Fecha de entrega prevista: {formatFecha(pedido.fecha_entrega)}
        </p>
      )}
    </div>
  );
}
