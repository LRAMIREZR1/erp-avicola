"use client";

import { useTransition } from "react";
import { restaurarPedido } from "@/app/admin/pedidos/actions";

export default function RestaurarPedidoButton({ pedidoId }: { pedidoId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(() => {
      restaurarPedido(pedidoId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-xs font-medium text-amber-700 hover:underline disabled:opacity-50"
    >
      {pending ? "Restaurando..." : "Restaurar"}
    </button>
  );
}
