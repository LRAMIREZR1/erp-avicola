"use client";

import { useTransition } from "react";
import { borrarHistorialPrecio } from "@/app/admin/productos/actions";

export default function BorrarHistorialPrecioButton({
  historialId,
  productoId,
}: {
  historialId: string;
  productoId: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const confirmado = window.confirm(
      "¿Eliminar este registro del historial de precios? No se puede deshacer."
    );
    if (!confirmado) return;

    startTransition(() => {
      borrarHistorialPrecio(historialId, productoId);
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
