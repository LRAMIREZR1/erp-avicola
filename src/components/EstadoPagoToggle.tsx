"use client";

import { useTransition } from "react";
import { marcarPagado } from "@/app/admin/cobranzas/actions";

export default function EstadoPagoToggle({
  pedidoId,
  pagado,
}: {
  pedidoId: string;
  pagado: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(() => {
      marcarPagado(pedidoId, !pagado);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={pagado ? "Click para marcar como no pagado" : "Click para marcar como pagado"}
      className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50 ${
        pagado
          ? "bg-green-100 text-green-700 hover:bg-green-200"
          : "bg-amber-100 text-amber-700 hover:bg-amber-200"
      }`}
    >
      {pending ? "..." : pagado ? "Pagado ✓" : "Marcar pagado"}
    </button>
  );
}
