"use client";

import { useTransition } from "react";
import { eliminarCompraAlimento } from "@/app/admin/alimentacion/actions";

export default function EliminarCompraAlimentoButton({ compraId }: { compraId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const confirmado = window.confirm(
      "¿Eliminar este registro de compra? Si ya estaba sumado al stock, se le restarán los kilos. No se puede deshacer."
    );
    if (!confirmado) return;
    startTransition(() => {
      eliminarCompraAlimento(compraId);
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
