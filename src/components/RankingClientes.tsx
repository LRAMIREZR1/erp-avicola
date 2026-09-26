"use client";

import { useState } from "react";
import { formatCLP } from "@/lib/format";

interface ClienteRanking {
  nombre: string;
  total: number;
  pedidos: number;
}

// Cuántos clientes se muestran de entrada, antes de tocar "Mostrar más".
const TOP_INICIAL = 10;

// Lista de clientes ya viene ordenada de mayor a menor (ver reportes/page.tsx)
// — este componente solo se encarga de recortarla a un Top 10 con un botón
// para desplegar el resto, y de calcular el % que representa cada cliente
// sobre el total vendido en el período.
export default function RankingClientes({
  clientes,
  totalPeriodo,
}: {
  clientes: ClienteRanking[];
  totalPeriodo: number;
}) {
  const [mostrarTodos, setMostrarTodos] = useState(false);

  if (clientes.length === 0) {
    return <p className="py-4 text-center text-sm text-stone-400">Sin datos</p>;
  }

  const visibles = mostrarTodos ? clientes : clientes.slice(0, TOP_INICIAL);
  const restantes = clientes.length - TOP_INICIAL;

  return (
    <div>
      <div className="divide-y divide-stone-100">
        {visibles.map((c, i) => {
          const porcentaje = totalPeriodo > 0 ? (c.total / totalPeriodo) * 100 : 0;
          return (
            <div key={c.nombre + i} className="flex items-center justify-between py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-stone-600">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-500">
                  {i + 1}
                </span>
                <span className="truncate">{c.nombre}</span>
                <span className="shrink-0 text-xs text-stone-400">
                  ({c.pedidos} pedido{c.pedidos === 1 ? "" : "s"})
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="font-medium text-stone-800">{formatCLP(c.total)}</span>
                <span className="ml-1.5 text-xs text-stone-400">({porcentaje.toFixed(1)}%)</span>
              </span>
            </div>
          );
        })}
      </div>

      {restantes > 0 && (
        <button
          type="button"
          onClick={() => setMostrarTodos((v) => !v)}
          className="mt-3 text-sm font-medium text-amber-700 hover:text-amber-800"
        >
          {mostrarTodos ? "Mostrar menos" : `Mostrar los ${restantes} restantes`}
        </button>
      )}
    </div>
  );
}
