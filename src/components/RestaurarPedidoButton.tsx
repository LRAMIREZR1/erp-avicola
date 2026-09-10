"use client";

import { useState } from "react";
import { restaurarPedido } from "@/app/admin/pedidos/actions";

export default function RestaurarPedidoButton({ pedidoId }: { pedidoId: string }) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const resultado = await restaurarPedido(pedidoId);
    setPending(false);
    if (resultado?.error) {
      window.alert(resultado.error);
    }
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
