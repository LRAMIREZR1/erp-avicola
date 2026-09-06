"use client";

export default function ImprimirButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
    >
      Imprimir carga
    </button>
  );
}
