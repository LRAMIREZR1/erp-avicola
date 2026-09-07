"use client";

import { useTransition } from "react";
import { borrarPedido } from "@/app/admin/pedidos/actions";

export default function BorrarPedidoButton({ pedidoId }: { pedidoId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const confirmado = window.confirm(
      "¿Eliminar este pedido? Se moverá a \"Eliminados\" y podrás restaurarlo después desde ahí. Si el pedido tenía stock descontado, se repondrá automáticamente."
    );
    if (!confirmado) return;

    startTransition(() => {
      borrarPedido(pedidoId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
    >
      {pending ? "Eliminando..." : "Eliminar"}
    </button>
  );
}
