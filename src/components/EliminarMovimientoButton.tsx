"use client";

import { useTransition } from "react";
import { eliminarMovimientoStock } from "@/app/admin/productos/movimientos/actions";

export default function EliminarMovimientoButton({ movimientoId }: { movimientoId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const confirmado = window.confirm(
      "¿Eliminar este registro del historial? Esto no cambia el stock actual del producto, solo borra el registro. No se puede deshacer."
    );
    if (!confirmado) return;

    startTransition(() => {
      eliminarMovimientoStock(movimientoId);
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
