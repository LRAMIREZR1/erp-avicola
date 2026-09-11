import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCLP, formatFecha, hoyChile } from "@/lib/format";
import EstadoSelector from "@/components/EstadoSelector";
import EstadoBadge from "@/components/EstadoBadge";
import BorrarPedidoButton from "@/components/BorrarPedidoButton";
import RestaurarPedidoButton from "@/components/RestaurarPedidoButton";
import EstadoPagoToggle from "@/components/EstadoPagoToggle";
import BotonAbonar from "@/components/BotonAbonar";
import EliminarAbonoButton from "@/components/EliminarAbonoButton";
import { registrarAbono } from "@/app/admin/cobranzas/actions";
import { requireRol } from "@/lib/roles";
import type { AbonoPedido } from "@/lib/supabase/types";

export default async function DetallePedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const rol = await requireRol(["administrador", "vendedor"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: pedido } = await supabase
    .from("pedidos")
    .select(
      "id, estado, total, fecha_pedido, fecha_entrega, notas, pagado, fecha_pago, motivo_descuento, clientes(nombre, telefono, direccion, zona_entrega), vendedores(nombre)"
    )
    .eq("id", id)
    .single();

  if (!pedido) notFound();

  const [{ data: items }, { data: abonosData }] = await Promise.all([
    supabase
      .from("pedido_items")
      .select("id, cantidad, precio_unitario, precio_lista, subtotal, productos(nombre)")
      .eq("pedido_id", id),
    pedido.estado === "entregado"
      ? supabase
          .from("abonos_pedido")
          .select("id, pedido_id, monto, fecha, nota, vendedor_id, created_at")
          .eq("pedido_id", id)
          .order("fecha", { ascending: false })
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as AbonoPedido[] }),
  ]);

  const listaItems = items ?? [];
  const totalLista = listaItems.reduce(
    (acc, item) => acc + item.cantidad * Number(item.precio_lista ?? item.precio_unitario),
    0
  );
  const descuento = totalLista - Number(pedido.total);

  const abonos = (abonosData ?? []) as AbonoPedido[];
  const totalAbonado = abonos.reduce((acc, a) => acc + Number(a.monto), 0);
  const saldoPendiente = Math.max(0, Number(pedido.total) - totalAbonado);
  const hoy = hoyChile();

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
          {rol === "administrador" && pedido.estado !== "eliminado" ? (
            <EstadoSelector pedidoId={pedido.id} estado={pedido.estado} />
          ) : (
            <EstadoBadge estado={pedido.estado} />
          )}
          {pedido.estado !== "eliminado" &&
            (rol === "administrador" || pedido.estado === "pendiente") && (
              <Link
                href={`/admin/pedidos/${pedido.id}/editar`}
                className="text-xs font-medium text-amber-700 hover:underline"
              >
                Editar
              </Link>
            )}
          {rol === "administrador" &&
            (pedido.estado === "eliminado" ? (
              <RestaurarPedidoButton pedidoId={pedido.id} />
            ) : (
              <BorrarPedidoButton pedidoId={pedido.id} />
            ))}
        </div>
      </div>

      {pedido.estado === "entregado" && (
        <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-stone-700">Cobro</p>
              <p className="text-xs text-stone-500">
                {pedido.pagado && pedido.fecha_pago
                  ? `Pagado el ${formatFecha(pedido.fecha_pago)}`
                  : "Aún no se ha registrado el pago"}
              </p>
            </div>
            {rol === "administrador" && (
              <EstadoPagoToggle pedidoId={pedido.id} pagado={pedido.pagado} />
            )}
          </div>

          {totalAbonado > 0 && (
            <div className="grid grid-cols-3 gap-3 border-t border-stone-100 pt-3 text-sm">
              <div>
                <p className="text-xs text-stone-500">Total</p>
                <p className="font-medium text-stone-800">{formatCLP(Number(pedido.total))}</p>
              </div>
              <div>
                <p className="text-xs text-stone-500">Abonado</p>
                <p className="font-medium text-green-700">{formatCLP(totalAbonado)}</p>
              </div>
              <div>
                <p className="text-xs text-stone-500">Saldo pendiente</p>
                <p className="font-semibold text-amber-700">{formatCLP(saldoPendiente)}</p>
              </div>
            </div>
          )}

          {!pedido.pagado && (rol === "administrador" || rol === "vendedor") && (
            <form
              action={registrarAbono.bind(null, pedido.id)}
              className="space-y-3 border-t border-stone-100 pt-3"
            >
              <p className="text-sm font-medium text-stone-700">Registrar abono</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="monto" className="mb-1 block text-xs font-medium text-stone-600">
                    Monto (CLP)
                  </label>
                  <input
                    id="monto"
                    type="number"
                    name="monto"
                    min={1}
                    max={saldoPendiente}
                    step="1"
                    required
                    placeholder={`Máx. ${formatCLP(saldoPendiente)}`}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="fecha_abono" className="mb-1 block text-xs font-medium text-stone-600">
                    Fecha
                  </label>
                  <input
                    id="fecha_abono"
                    type="date"
                    name="fecha"
                    defaultValue={hoy}
                    max={hoy}
                    required
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="nota_abono" className="mb-1 block text-xs font-medium text-stone-600">
                    Nota (opcional)
                  </label>
                  <input
                    id="nota_abono"
                    type="text"
                    name="nota"
                    placeholder="Ej: depositó por transferencia"
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>
              <BotonAbonar />
            </form>
          )}

          {abonos.length > 0 && (
            <div className="border-t border-stone-100 pt-3">
              <p className="mb-2 text-sm font-medium text-stone-700">Abonos registrados</p>
              <div className="divide-y divide-stone-100">
                {abonos.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2 text-sm">
                    <div className="text-stone-600">
                      {formatFecha(a.fecha)}
                      {a.nota && <span className="text-stone-400"> · {a.nota}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-stone-800">{formatCLP(Number(a.monto))}</span>
                      {rol === "administrador" && (
                        <EliminarAbonoButton abonoId={a.id} pedidoId={pedido.id} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
          {listaItems.map((item) => {
            const precioLista = Number(item.precio_lista ?? item.precio_unitario);
            const conDescuento = Number(item.precio_unitario) < precioLista;
            return (
              <div key={item.id} className="py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-stone-700">
                    {(item as unknown as { productos: { nombre: string } | null }).productos
                      ?.nombre ?? "Producto"}{" "}
                    × {item.cantidad}
                  </span>
                  <span className="text-stone-800">{formatCLP(Number(item.subtotal))}</span>
                </div>
                {conDescuento && (
                  <p className="text-right text-xs text-amber-700">
                    Precio de lista: {formatCLP(precioLista)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 space-y-1 border-t border-stone-200 pt-3">
          {descuento > 0.5 && (
            <div className="flex items-center justify-between text-sm text-amber-700">
              <span>Descuento aplicado{pedido.motivo_descuento ? ` (${pedido.motivo_descuento})` : ""}</span>
              <span>-{formatCLP(descuento)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-stone-700">Total</span>
            <span className="text-lg font-semibold text-stone-800">
              {formatCLP(Number(pedido.total))}
            </span>
          </div>
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
