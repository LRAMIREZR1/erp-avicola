"use client";

import { useTransition } from "react";
import { eliminarRecoleccion } from "@/app/admin/produccion/actions";

export default function EliminarRecoleccionButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const confirmado = window.confirm(
      "¿Eliminar este registro de recolección? No se puede deshacer."
    );
    if (!confirmado) return;
    startTransition(() => {
      eliminarRecoleccion(id);
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
