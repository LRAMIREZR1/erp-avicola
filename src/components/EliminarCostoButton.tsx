"use client";

import { useTransition } from "react";
import { eliminarCosto } from "@/app/admin/costos/actions";

export default function EliminarCostoButton({ costoId }: { costoId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const confirmado = window.confirm("¿Eliminar este registro de costo? No se puede deshacer.");
    if (!confirmado) return;
    startTransition(() => {
      eliminarCosto(costoId);
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
