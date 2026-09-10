"use client";

import { useTransition } from "react";
import { eliminarMovimientoStock } from "@/app/admin/productos/movimientos/actions";

export default function EliminarMovimientoButton({
  movimientoId,
  productoNombre,
  tipo,
  cantidad,
}: {
  movimientoId: string;
  productoNombre: string;
  tipo: string;
  cantidad: number;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    // Mismo cálculo que en la acción del servidor: cuánto va a cambiar el
    // stock al revertir este movimiento, para que la confirmación sea
    // específica y no una advertencia genérica.
    const efecto = tipo === "salida" ? -cantidad : cantidad;
    const verbo = efecto >= 0 ? "bajar" : "subir";
    const confirmado = window.confirm(
      `¿Eliminar este registro de "${productoNombre}"? El stock va a ${verbo} en ${Math.abs(
        efecto
      )} unidad${Math.abs(efecto) === 1 ? "" : "es"} para revertirlo. No se puede deshacer.`
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
