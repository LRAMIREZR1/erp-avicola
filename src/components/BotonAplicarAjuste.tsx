"use client";

import { useFormStatus } from "react-dom";

// Botón "Aplicar" del ajuste manual de stock (en Productos). Usa
// useFormStatus para saber si el <form> que lo contiene está enviándose, así
// que muestra "Aplicando…" y se desactiva mientras tanto — antes no daba
// ninguna señal visual, así que quien lo usaba no sabía si había funcionado
// y a veces hacía doble clic, aplicando el mismo ajuste dos veces.
export default function BotonAplicarAjuste() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-200 disabled:opacity-60"
    >
      {pending ? "Aplicando…" : "Aplicar"}
    </button>
  );
}
