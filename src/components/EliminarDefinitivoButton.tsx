"use client";

import { useTransition } from "react";
import { borrarPedidoDefinitivo } from "@/app/admin/pedidos/actions";

export default function EliminarDefinitivoButton({ pedidoId }: { pedidoId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const confirmado = window.confirm(
      "¿Borrar este pedido definitivamente de la base de datos? A diferencia de \"Eliminar\", esto NO se puede deshacer — no va a quedar ni en el filtro \"Eliminados\"."
    );
    if (!confirmado) return;

    startTransition(() => {
      borrarPedidoDefinitivo(pedidoId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
    >
      {pending ? "Borrando..." : "Borrar definitivo"}
    </button>
  );
}
