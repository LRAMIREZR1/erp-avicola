"use client";

import { useTransition } from "react";
import { eliminarCategoriaCosto } from "@/app/admin/costos/actions";

// A diferencia de EliminarCostoButton, esta eliminación puede fallar (si la
// categoría todavía tiene costos registrados) — la acción devuelve un
// resultado en vez de solo ejecutar, y acá se muestra el mensaje si falla.
export default function EliminarCategoriaCostoButton({
  categoriaId,
  nombre,
}: {
  categoriaId: string;
  nombre: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const confirmado = window.confirm(`¿Eliminar la categoría "${nombre}"? No se puede deshacer.`);
    if (!confirmado) return;
    startTransition(async () => {
      const resultado = await eliminarCategoriaCosto(categoriaId);
      if (!resultado.ok) {
        window.alert(resultado.error ?? "No se pudo eliminar la categoría.");
      }
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
