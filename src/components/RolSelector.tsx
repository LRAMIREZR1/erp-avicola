"use client";

import { useTransition } from "react";
import { cambiarRolUsuario } from "@/app/admin/usuarios/actions";
import { NOMBRES_ROL, type Rol } from "@/lib/supabase/types";

const ROLES: Rol[] = ["administrador", "vendedor", "encargado_bodega", "repartidor"];

export default function RolSelector({
  vendedorId,
  rol,
  disabled,
}: {
  vendedorId: string;
  rol: Rol;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={rol}
      disabled={pending || disabled}
      onChange={(e) =>
        startTransition(() => {
          cambiarRolUsuario(vendedorId, e.target.value as Rol);
        })
      }
      className="rounded-lg border border-stone-300 px-2 py-1 text-sm focus:border-amber-600 focus:outline-none disabled:opacity-50"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {NOMBRES_ROL[r]}
        </option>
      ))}
    </select>
  );
}
