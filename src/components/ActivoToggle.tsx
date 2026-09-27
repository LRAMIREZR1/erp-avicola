"use client";

import { useTransition } from "react";
import { cambiarActivoUsuario } from "@/app/admin/usuarios/actions";

export default function ActivoToggle({
  vendedorId,
  activo,
  disabled,
}: {
  vendedorId: string;
  activo: boolean;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending || disabled}
      onClick={() =>
        startTransition(() => {
          cambiarActivoUsuario(vendedorId, !activo);
        })
      }
      className={`rounded-lg border px-3 py-1 text-xs font-medium disabled:opacity-50 ${
        activo
          ? "border-stone-300 text-stone-600 hover:bg-stone-100"
          : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
      }`}
    >
      {activo ? "Dar de baja" : "Dar de alta"}
    </button>
  );
}
