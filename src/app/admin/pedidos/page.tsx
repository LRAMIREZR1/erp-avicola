import { Fragment } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCLP, formatFecha } from "@/lib/format";
import EstadoSelector from "@/components/EstadoSelector";
import EstadoBadge from "@/components/EstadoBadge";
import BorrarPedidoButton from "@/components/BorrarPedidoButton";
import { requireRol } from "@/lib/roles";
import { NOMBRES_ESTADO, type EstadoPedido } from "@/lib/supabase/types";

// Orden operativo: lo que hay que trabajar primero arriba, lo ya cerrado al final.
const ORDEN_ESTADO: Record<EstadoPedido, number> = {
  pendiente: 0,
  confirmado: 1,
  en_preparacion: 2,
  entregado: 3,
  cancelado: 4,
};
const ESTADOS_EN_ORDEN: EstadoPedido[] = [
  "pendiente",
  "confirmado",
  "en_preparacion",
  "entregado",
  "cancelado",
];

interface Fila {
  id: string;
  estado: EstadoPedido;
  total: number;
  fecha_pedido: string;
  fecha_entrega: string | null;
  clientes: { nombre: string } | null;
  vendedores: { nombre: string } | null;
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; orden?: string }>;
}) {
  const rol = await requireRol(["administrador", "vendedor"]);
  const { estado, orden } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("pedidos")
    .select("id, estado, total, fecha_pedido, fecha_entrega, clientes(nombre), vendedores(nombre)")
    .eq("origen", "pedido")
    .order("created_at", { ascending: false });

  if (estado) {
    query = query.eq("estado", estado);
  }

  const { data } = await query;
  const pedidos = (data ?? []) as unknown as Fila[];

  // Vista por defecto: agrupada por estado (pendiente -> ... -> cancelado), y
  // dentro de cada grupo por fecha de entrega más próxima primero. Se puede
  // volver al orden cronológico simple pinchando el encabezado "Estado".
  const agrupado = !estado && orden !== "fecha";

  const lista = agrupado
    ? [...pedidos].sort((a, b) => {
        const diff = ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado];
        if (diff !== 0) return diff;
        const fechaA = a.fecha_entrega ?? a.fecha_pedido;
        const fechaB = b.fecha_entrega ?? b.fecha_pedido;
        return fechaA.localeCompare(fechaB);
      })
    : pedidos;

  const filtros: { label: string; value?: EstadoPedido }[] = [
    { label: "Todos" },
    { label: "Pendientes", value: "pendiente" },
    { label: "Confirmados", value: "confirmado" },
    { label: "En preparación", value: "en_preparacion" },
    { label: "Entregados", value: "entregado" },
    { label: "Cancelados", value: "cancelado" },
  ];

  function filaPedido(p: Fila) {
    return (
      <tr key={p.id} className="hover:bg-stone-50">
        <td className="px-4 py-3 font-medium text-stone-800">{p.clientes?.nombre ?? "—"}</td>
        <td className="px-4 py-3 text-stone-600">{p.vendedores?.nombre ?? "—"}</td>
        <td className="px-4 py-3 text-stone-600">{formatFecha(p.fecha_pedido)}</td>
        <td className="px-4 py-3 text-stone-600">
          {p.fecha_entrega ? formatFecha(p.fecha_entrega) : "—"}
        </td>
        <td className="px-4 py-3 font-medium text-stone-800">{formatCLP(Number(p.total))}</td>
        <td className="px-4 py-3">
          {rol === "administrador" ? (
            <EstadoSelector pedidoId={p.id} estado={p.estado} />
          ) : (
            <EstadoBadge estado={p.estado} />
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-3">
            <Link href={`/admin/pedidos/${p.id}`} className="text-amber-700 hover:underline">
              Ver
            </Link>
            {(rol === "administrador" || p.estado === "pendiente") && (
              <Link
                href={`/admin/pedidos/${p.id}/editar`}
                className="text-amber-700 hover:underline"
              >
                Editar
              </Link>
            )}
            {rol === "administrador" && <BorrarPedidoButton pedidoId={p.id} />}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-stone-800">Pedidos</h1>
          <p className="text-sm text-stone-500">Todos los pedidos registrados</p>
        </div>
        <Link
          href="/admin/pedidos/nuevo"
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          + Nuevo pedido
        </Link>
      </div>

      <div className="flex gap-2">
        {filtros.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/admin/pedidos?estado=${f.value}` : "/admin/pedidos"}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              estado === f.value || (!estado && !f.value)
                ? "bg-stone-800 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Vendedor</th>
              <th className="px-4 py-3">Fecha pedido</th>
              <th className="px-4 py-3">Entrega</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">
                {estado ? (
                  "Estado"
                ) : (
                  <Link
                    href={agrupado ? "/admin/pedidos?orden=fecha" : "/admin/pedidos"}
                    className="inline-flex items-center gap-1 normal-case text-stone-500 hover:text-stone-800"
                    title={
                      agrupado
                        ? "Agrupado por estado — clic para ordenar por fecha"
                        : "Ordenado por fecha — clic para agrupar por estado"
                    }
                  >
                    <span className="uppercase">Estado</span>
                    <span aria-hidden>{agrupado ? "▾" : "↕"}</span>
                  </Link>
                )}
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {agrupado
              ? ESTADOS_EN_ORDEN.map((est) => {
                  const grupo = lista.filter((p) => p.estado === est);
                  if (grupo.length === 0) return null;
                  return (
                    <Fragment key={est}>
                      <tr className="bg-stone-50">
                        <td
                          colSpan={7}
                          className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500"
                        >
                          {NOMBRES_ESTADO[est]} ({grupo.length})
                        </td>
                      </tr>
                      {grupo.map((p) => filaPedido(p))}
                    </Fragment>
                  );
                })
              : lista.map((p) => filaPedido(p))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                  No hay pedidos en esta vista
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
