"use client";

import { useTransition } from "react";
import { eliminarPrecioMercado } from "@/app/admin/precio-mercado/actions";

export default function EliminarPrecioMercadoButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const confirmado = window.confirm("¿Eliminar este precio registrado? No se puede deshacer.");
    if (!confirmado) return;

    startTransition(() => {
      eliminarPrecioMercado(id);
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
