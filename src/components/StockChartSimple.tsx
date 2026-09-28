"use client";

import { useState } from "react";

export interface StockChartSimpleDatum {
  categoria: string;
  valor: number;
}

function nicerMax(value: number) {
  if (value <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const step = magnitude <= 1 ? 1 : magnitude / 2;
  return Math.ceil(value / step) * step;
}

// Versión de una sola serie de StockChart: un solo color, una barra por
// categoría. Se usa para separar "Stock disponible por categoría" en dos
// gráficos lado a lado (cajas / bandejas) en vez de barras agrupadas.
export default function StockChartSimple({
  data,
  color,
  etiqueta,
}: {
  data: StockChartSimpleDatum[];
  color: string;
  etiqueta: string;
}) {
  const [hover, setHover] = useState<{ categoria: string; valor: number } | null>(null);

  const maxValor = Math.max(1, ...data.map((d) => d.valor));
  const niceMax = nicerMax(maxValor);
  const total = data.reduce((acc, d) => acc + d.valor, 0);
  const ticks = [0, niceMax * 0.25, niceMax * 0.5, niceMax * 0.75, niceMax];

  const width = 380;
  const height = 220;
  const padLeft = 40;
  const padBottom = 28;
  const padTop = 12;
  const plotW = width - padLeft - 16;
  const plotH = height - padBottom - padTop;

  const groupW = plotW / Math.max(1, data.length);
  const barW = Math.min(32, groupW * 0.6);

  function y(valor: number) {
    return padTop + plotH - (valor / niceMax) * plotH;
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5 text-xs text-stone-600">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: color }}
        />
        {etiqueta}
        <span className="font-semibold text-stone-800">{total} disponibles</span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          role="img"
          aria-label={`${etiqueta} disponibles por categoría`}
        >
          {/* gridlines */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={padLeft}
                x2={width - 8}
                y1={y(t)}
                y2={y(t)}
                stroke="#e1e0d9"
                strokeWidth={1}
              />
              <text x={padLeft - 8} y={y(t) + 3} textAnchor="end" fontSize={10} fill="#898781">
                {Math.round(t)}
              </text>
            </g>
          ))}
          {/* baseline */}
          <line
            x1={padLeft}
            x2={width - 8}
            y1={y(0)}
            y2={y(0)}
            stroke="#c3c2b7"
            strokeWidth={1}
          />

          {data.map((d, i) => {
            const groupX = padLeft + i * groupW + groupW / 2;
            const barH = plotH - (y(d.valor) - padTop);
            const isHovered = hover?.categoria === d.categoria;
            return (
              <g
                key={d.categoria}
                onMouseEnter={() => setHover({ categoria: d.categoria, valor: d.valor })}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={groupX - barW / 2}
                  y={y(d.valor)}
                  width={barW}
                  height={Math.max(0, barH)}
                  rx={4}
                  fill={color}
                  opacity={isHovered ? 1 : 0.9}
                />
                <text
                  x={groupX}
                  y={y(d.valor) - 4}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#52514e"
                >
                  {d.valor}
                </text>
                <text
                  x={groupX}
                  y={height - padBottom + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#52514e"
                >
                  {d.categoria}
                </text>
              </g>
            );
          })}
        </svg>

        {hover && (
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs shadow-sm">
            <span className="font-medium text-stone-800">{hover.categoria}</span>
            <span className="text-stone-500"> · </span>
            <span className="font-medium text-stone-800">{hover.valor} disponibles</span>
          </div>
        )}
      </div>
    </div>
  );
}
