"use client";

import { useState, useTransition } from "react";
import { marcarEntregadoConCobro } from "@/app/admin/pedidos/actions";
import { formatCLP } from "@/lib/format";

// Acepta uno o varios pedidos (un cliente puede tener más de un pedido
// agrupado en la misma parada de reparto) y los marca "entregado" a todos
// con un solo clic. Si queda algo pendiente de cobro, muestra un check para
// marcarlo pagado en el mismo paso (ej. pagó en efectivo al recibir), sin
// tener que pasar después por Cobranzas.
export default function MarcarEntregadoButton({
  pedidoIds,
  totalPendiente,
}: {
  pedidoIds: string[];
  totalPendiente: number;
}) {
  const [cobrado, setCobrado] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(() => {
      marcarEntregadoConCobro(pedidoIds, cobrado);
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {totalPendiente > 0 && (
        <label className="flex items-center gap-2 text-xs font-medium text-stone-600">
          <input
            type="checkbox"
            checked={cobrado}
            onChange={(e) => setCobrado(e.target.checked)}
            disabled={pending}
            className="h-4 w-4 rounded border-stone-300 text-amber-700 focus:ring-amber-600"
          />
          Cobré {formatCLP(totalPendiente)} en efectivo
        </label>
      )}
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
    </div>
  );
}
