"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const OPCIONES_SEMANAS = [4, 8, 12, 26];

// Filtro de "Panel de control de ventas". Es un cliente (no un <form> GET
// normal) para poder mostrar "Filtrando..." en el botón mientras se carga
// la nueva página con el rango elegido, y así evitar que, por duda, lo
// vuelvan a apretar dos veces.
export default function FiltroPanelVentas({ valorActual }: { valorActual: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [valor, setValor] = useState(valorActual);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      router.push(`/admin/panel-ventas?semanas=${valor}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div>
        <label htmlFor="semanas" className="mb-1 block text-xs font-medium text-stone-600">
          Ver
        </label>
        <select
          id="semanas"
          value={valor}
          onChange={(e) => setValor(Number(e.target.value))}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
        >
          {OPCIONES_SEMANAS.map((n) => (
            <option key={n} value={n}>
              Últimas {n} semanas
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Filtrando..." : "Filtrar"}
      </button>
    </form>
  );
}
