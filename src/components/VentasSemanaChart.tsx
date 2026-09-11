"use client";

import { useState } from "react";
import { formatCLP } from "@/lib/format";

export interface VentaSemanaDatum {
  // Lunes de la semana (YYYY-MM-DD), clave única de cada barra.
  semana: string;
  // Etiqueta corta para el eje X (ej. "1 sep").
  etiqueta: string;
  // Rango completo para el tooltip (ej. "1 sep – 7 sep").
  rango: string;
  total: number;
  pedidos: number;
  esActual: boolean;
}

// Mismo azul que usa la sección "Ventas" del menú (sky), para que el
// gráfico se lea como parte de esa sección de un vistazo.
const COLOR_BARRA = "#0284c7";
const COLOR_ACTUAL = "#f59e0b";

function nicerMax(value: number) {
  if (value <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const step = magnitude <= 1 ? 1 : magnitude / 2;
  return Math.ceil(value / step) * step;
}

// Barras con el total vendido por semana + una línea punteada con el
// promedio del período, para ver de un vistazo si una semana estuvo sobre
// o bajo lo normal. La semana actual (en curso) se marca con un punto
// ámbar arriba de su barra, ya que todavía no terminó y no es justo
// compararla 1 a 1 con semanas completas.
export default function VentasSemanaChart({ data }: { data: VentaSemanaDatum[] }) {
  const [hover, setHover] = useState<string | null>(null);

  const totales = data.map((d) => d.total);
  const maxValor = Math.max(1, ...totales);
  const niceMax = nicerMax(maxValor);
  const promedio = data.length > 0 ? totales.reduce((acc, t) => acc + t, 0) / data.length : 0;
  const ticks = [0, niceMax * 0.25, niceMax * 0.5, niceMax * 0.75, niceMax];

  const width = 620;
  const height = 240;
  const padLeft = 56;
  const padRight = 16;
  const padBottom = 28;
  const padTop = 20;
  const plotW = width - padLeft - padRight;
  const plotH = height - padBottom - padTop;
  const plotRight = width - padRight;

  const groupW = plotW / Math.max(1, data.length);
  const barW = Math.min(28, groupW * 0.6);

  function y(valor: number) {
    return padTop + plotH - (valor / niceMax) * plotH;
  }

  const datoHover = data.find((d) => d.semana === hover) ?? null;
  // Cada cuántas barras mostrar etiqueta en el eje X, para que no se
  // amontonen cuando hay muchas semanas (26).
  const pasoEtiqueta = data.length > 14 ? Math.ceil(data.length / 10) : 1;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-stone-600">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLOR_BARRA }} />
          Total vendido por semana
        </div>
        <div className="flex items-center gap-1.5 text-xs text-stone-600">
          <span className="inline-block h-0 w-3.5 border-t-2 border-dashed border-stone-400" />
          Promedio del período
          <span className="font-semibold text-stone-800">{formatCLP(promedio)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-stone-600">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_ACTUAL }} />
          Esta semana (en curso)
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          role="img"
          aria-label="Total vendido por semana, período seleccionado"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padLeft} x2={plotRight} y1={y(t)} y2={y(t)} stroke="#e1e0d9" strokeWidth={1} />
              <text x={padLeft - 8} y={y(t) + 3} textAnchor="end" fontSize={10} fill="#898781">
                {formatCLP(t)}
              </text>
            </g>
          ))}
          <line x1={padLeft} x2={plotRight} y1={y(0)} y2={y(0)} stroke="#c3c2b7" strokeWidth={1} />

          {promedio > 0 && (
            <line
              x1={padLeft}
              x2={plotRight}
              y1={y(promedio)}
              y2={y(promedio)}
              stroke="#78766f"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          )}

          {data.map((d, i) => {
            const x = padLeft + i * groupW + (groupW - barW) / 2;
            const isHovered = hover === d.semana;
            const mostrarEtiqueta = i % pasoEtiqueta === 0 || i === data.length - 1;
            return (
              <g
                key={d.semana}
                onMouseEnter={() => setHover(d.semana)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={x}
                  y={y(d.total)}
                  width={barW}
                  height={Math.max(0, y(0) - y(d.total))}
                  fill={d.esActual ? COLOR_ACTUAL : COLOR_BARRA}
                  opacity={isHovered ? 1 : 0.85}
                  rx={2}
                />
                {mostrarEtiqueta && (
                  <text
                    x={x + barW / 2}
                    y={height - padBottom + 16}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#52514e"
                  >
                    {d.etiqueta}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {datoHover && (
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs shadow-sm">
            <span className="font-medium text-stone-800">{datoHover.rango}</span>
            <span className="text-stone-500"> · Total: </span>
            <span className="font-medium text-stone-800">{formatCLP(datoHover.total)}</span>
            <span className="text-stone-500"> · Pedidos: </span>
            <span className="font-medium text-stone-800">{datoHover.pedidos}</span>
          </div>
        )}
      </div>
    </div>
  );
}
