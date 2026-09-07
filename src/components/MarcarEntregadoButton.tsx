"use client";

import { useTransition } from "react";
import { cambiarEstadoPedido } from "@/app/admin/pedidos/actions";

export default function MarcarEntregadoButton({ pedidoId }: { pedidoId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(() => {
      cambiarEstadoPedido(pedidoId, "entregado");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
    >
      {pending ? "Marcando..." : "Marcar entregado"}
    </button>
  );
}
