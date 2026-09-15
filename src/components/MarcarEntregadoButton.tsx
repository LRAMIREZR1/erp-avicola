"use client";

import { useTransition } from "react";
import { cambiarEstadoPedido } from "@/app/admin/pedidos/actions";

// Acepta uno o varios pedidos (un cliente puede tener más de un pedido
// agrupado en la misma parada de reparto) y los marca "entregado" a todos
// con un solo clic.
export default function MarcarEntregadoButton({ pedidoIds }: { pedidoIds: string[] }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      for (const id of pedidoIds) {
        await cambiarEstadoPedido(id, "entregado");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
    >
      {pending
        ? "Marcando..."
        : pedidoIds.length > 1
          ? `Marcar ${pedidoIds.length} entregados`
          : "Marcar entregado"}
    </button>
  );
}
