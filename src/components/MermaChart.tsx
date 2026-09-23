"use client";

import { useState } from "react";

export interface MermaDatum {
  // Fecha YYYY-MM-DD (hora Chile).
  fecha: string;
  // Etiqueta corta para el eje X (ej. "lun 8").
  etiqueta: string;
  // Huevos rotos ese día. 0 es un valor real (no se rompió nada ese día),
  // no "sin dato".
  cantidad: number;
}

const COLOR = "#dc2626";

function nicerMax(value: number) {
  if (value <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const step = magnitude <= 1 ? 1 : magnitude / 2;
  return Math.ceil(value / step) * step;
}

interface HoverInfo {
  fecha: string;
  etiqueta: string;
  cantidad: number;
}

// Barras de huevos rotos día a día, con línea de promedio punteada.
export default function MermaChart({ data }: { data: MermaDatum[] }) {
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const maxValor = Math.max(1, ...data.map((d) => d.cantidad));
  const niceMax = nicerMax(maxValor);
  const promedio = data.length > 0 ? data.reduce((acc, d) => acc + d.cantidad, 0) / data.length : 0;
  const ticks = [0, niceMax * 0.25, niceMax * 0.5, niceMax * 0.75, niceMax];

  const width = 620;
  const height = 200;
  const padLeft = 40;
  const padRight = 16;
  const padBottom = 28;
  const padTop = 12;
  const plotW = width - padLeft - padRight;
  const plotH = height - padBottom - padTop;
  const plotRight = width - padRight;

  const groupW = plotW / Math.max(1, data.length);
  const barW = Math.min(28, groupW * 0.55);

  function y(valor: number) {
    return padTop + plotH - (valor / niceMax) * plotH;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-stone-600">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLOR }} />
          Huevos rotos
        </div>
        <div className="flex items-center gap-1.5 text-xs text-stone-600">
          <span className="inline-block h-0 w-3.5 border-t-2 border-dashed border-stone-400" />
          Promedio del período
          <span className="font-semibold text-stone-800">
            {promedio.toLocaleString("es-CL", { maximumFractionDigits: 1 })}
          </span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          role="img"
          aria-label="Huevos rotos por día, últimos días"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={padLeft}
                x2={plotRight}
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

          {data.map((d, i) => {
            const x = padLeft + i * groupW + groupW / 2;
            const isHovered = hover?.fecha === d.fecha;
            const barY = y(d.cantidad);
            return (
              <g
                key={d.fecha}
                onMouseEnter={() => setHover({ fecha: d.fecha, etiqueta: d.etiqueta, cantidad: d.cantidad })}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
                {/* área de hover invisible, más ancha que la barra, para que
                    sea fácil pasar el mouse por encima */}
                <rect x={x - groupW / 2} y={padTop} width={groupW} height={plotH} fill="transparent" />
                <rect
                  x={x - barW / 2}
                  y={barY}
                  width={barW}
                  height={Math.max(0, y(0) - barY)}
                  rx={2}
                  fill={COLOR}
                  opacity={isHovered ? 1 : 0.85}
                />
                <text
                  x={x}
                  y={height - padBottom + 16}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#52514e"
                >
                  {d.etiqueta}
                </text>
              </g>
            );
          })}

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
        </svg>

        {hover && (
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs shadow-sm">
            <span className="font-medium text-stone-800">{hover.etiqueta}</span>
            <span className="text-stone-500"> · Rotos: </span>
            <span className="font-medium text-stone-800">{hover.cantidad}</span>
          </div>
        )}
      </div>
    </div>
  );
}
