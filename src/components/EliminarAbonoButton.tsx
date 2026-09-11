"use client";

import { useTransition } from "react";
import { eliminarAbono } from "@/app/admin/cobranzas/actions";

export default function EliminarAbonoButton({
  abonoId,
  pedidoId,
}: {
  abonoId: string;
  pedidoId: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const confirmado = window.confirm("¿Eliminar este abono? No se puede deshacer.");
    if (!confirmado) return;

    startTransition(() => {
      eliminarAbono(abonoId, pedidoId);
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
