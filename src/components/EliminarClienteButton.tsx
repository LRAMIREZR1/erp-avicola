"use client";

import { useTransition } from "react";
import { eliminarCliente } from "@/app/admin/clientes/actions";

export default function EliminarClienteButton({ clienteId }: { clienteId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const confirmado = window.confirm(
      "¿Eliminar este cliente definitivamente? No se puede deshacer."
    );
    if (!confirmado) return;

    startTransition(() => {
      eliminarCliente(clienteId);
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
