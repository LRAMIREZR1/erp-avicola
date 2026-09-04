"use client";

import { useTransition } from "react";
import { cambiarEstadoPedido } from "@/app/admin/pedidos/actions";
import { NOMBRES_ESTADO, type EstadoPedido } from "@/lib/supabase/types";

const ESTADOS: EstadoPedido[] = ["pendiente", "en_preparacion", "entregado", "cancelado"];

const COLORES: Record<EstadoPedido, string> = {
  pendiente: "bg-stone-100 text-stone-700",
  en_preparacion: "bg-blue-100 text-blue-700",
  entregado: "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-700",
};

export default function EstadoSelector({
  pedidoId,
  estado,
}: {
  pedidoId: string;
  estado: EstadoPedido;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={estado}
      disabled={pending}
      onChange={(e) =>
        startTransition(() => {
          cambiarEstadoPedido(pedidoId, e.target.value as EstadoPedido);
        })
      }
      className={`rounded-full border-0 px-2 py-1 text-xs font-medium focus:outline-none ${COLORES[estado]}`}
    >
      {ESTADOS.map((e) => (
        <option key={e} value={e}>
          {NOMBRES_ESTADO[e]}
        </option>
      ))}
    </select>
  );
}
