"use client";

import { useState } from "react";
import { borrarPedido } from "@/app/admin/pedidos/actions";

export default function BorrarPedidoButton({ pedidoId }: { pedidoId: string }) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    const confirmado = window.confirm(
      "¿Eliminar este pedido? Se moverá a \"Eliminados\" y podrás restaurarlo después desde ahí. Si el pedido tenía stock descontado, se repondrá automáticamente."
    );
    if (!confirmado) return;

    setPending(true);
    // Si todo sale bien, borrarPedido redirige a /admin/pedidos — este
    // componente nunca llega a re-renderizar con pending=false en ese caso.
    // Si falla (p. ej. el pedido ya no está en un estado eliminable), nos
    // devuelve el motivo en vez de lanzar un error (un "throw" dentro de una
    // Server Action llega al navegador con el mensaje oculto en producción).
    const resultado = await borrarPedido(pedidoId);
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
      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
    >
      {pending ? "Eliminando..." : "Eliminar"}
    </button>
  );
}
