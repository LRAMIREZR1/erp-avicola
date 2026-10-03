"use client";

import { useTransition } from "react";
import { eliminarMerma } from "@/app/admin/produccion/actions";

export default function EliminarMermaButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const confirmado = window.confirm("¿Eliminar este registro de merma? No se puede deshacer.");
    if (!confirmado) return;
    startTransition(() => {
      eliminarMerma(id);
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
