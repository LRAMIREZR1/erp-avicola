"use client";

import { useState } from "react";

// Grupo de la tabla de pedidos que arranca cerrado (ej. "Entregados"), para
// que la vista "Todos" ponga el ojo en lo que falta trabajar (pendientes,
// confirmados, en preparación) y no se llene de pedidos ya cerrados. Un clic
// en el encabezado lo despliega.
export default function GrupoPedidosColapsable({
  etiqueta,
  cantidad,
  colorTexto,
  colorBorde,
  children,
}: {
  etiqueta: string;
  cantidad: number;
  colorTexto: string;
  colorBorde: string;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <tr className="bg-stone-50">
        <td colSpan={7} className={`border-l-4 px-4 py-2 ${colorBorde}`}>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            className={`flex w-full items-center gap-2 text-xs font-semibold uppercase tracking-wide ${colorTexto}`}
          >
            <span aria-hidden className={`inline-block transition-transform ${abierto ? "rotate-90" : ""}`}>
              ▸
            </span>
            {etiqueta} ({cantidad})
            <span className="ml-auto normal-case text-stone-400">
              {abierto ? "Ocultar" : "Mostrar"}
            </span>
          </button>
        </td>
      </tr>
      {abierto && children}
    </>
  );
}
