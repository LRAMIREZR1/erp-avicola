"use client";

import { useState } from "react";

export interface PosturaDatum {
  // Fecha YYYY-MM-DD (hora Chile).
  fecha: string;
  // Etiqueta corta para el eje X (ej. "lun 8").
  etiqueta: string;
  // % de postura ese día (huevos del día / gallinas activas × 100). 0
  // significa "no se pudo calcular ese día" (sin huevos registrados), no
  // "0% de postura" — así que esos días quedan como hueco en la línea.
  porcentaje: number;
}

// Mismo tono que los botones principales de la página, para que se lea como
// "el gráfico de esta sección" sin competir con el naranja de las cajas.
const COLOR = "#b45309";

function nicerMax(value: number) {
  if (value <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const step = magnitude <= 1 ? 1 : magnitude / 2;
  return Math.ceil(value / step) * step;
}

interface HoverInfo {
  fecha: string;
  etiqueta: string;
  porcentaje: number;
}

// Línea simple del % de postura día a día, con línea de promedio punteada y
// huecos en los días sin dato (en vez de una caída falsa a 0%).
export default function PosturaChart({ data }: { data: PosturaDatum[] }) {
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const conDato = data.filter((d) => d.porcentaje > 0);
  const maxValor = Math.max(1, ...data.map((d) => d.porcentaje));
  const niceMax = nicerMax(maxValor);
  const promedio =
    conDato.length > 0 ? conDato.reduce((acc, d) => acc + d.porcentaje, 0) / conDato.length : 0;
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

  function y(valor: number) {
    return padTop + plotH - (valor / niceMax) * plotH;
  }

  // Conecta con una línea solo los días que sí tienen dato — los días sin
  // registro quedan como un hueco, en vez de dibujar una caída falsa a 0%.
  const segmentos: { x: number; y: number }[][] = [];
  let segmentoActual: { x: number; y: number }[] = [];
  data.forEach((d, i) => {
    if (d.porcentaje > 0) {
      segmentoActual.push({ x: padLeft + i * groupW + groupW / 2, y: y(d.porcentaje) });
    } else if (segmentoActual.length > 0) {
      segmentos.push(segmentoActual);
      segmentoActual = [];
    }
  });
  if (segmentoActual.length > 0) segmentos.push(segmentoActual);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-stone-600">
          <span className="inline-block h-0.5 w-3.5 rounded" style={{ backgroundColor: COLOR }} />
          % de postura
        </div>
        <div className="flex items-center gap-1.5 text-xs text-stone-600">
          <span className="inline-block h-0 w-3.5 border-t-2 border-dashed border-stone-400" />
          Promedio del período
          <span className="font-semibold text-stone-800">
            {promedio.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%
          </span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          role="img"
          aria-label="Porcentaje de postura diario, últimos días"
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
                {Math.round(t)}%
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

          {segmentos.map((seg, si) => (
            <polyline
              key={si}
              points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={COLOR}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {data.map((d, i) => {
            const x = padLeft + i * groupW + groupW / 2;
            const isHovered = hover?.fecha === d.fecha;
            return (
              <g
                key={d.fecha}
                onMouseEnter={() =>
                  setHover({ fecha: d.fecha, etiqueta: d.etiqueta, porcentaje: d.porcentaje })
                }
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
                {/* área de hover invisible, más ancha que el punto, para que
                    sea fácil pasar el mouse por encima */}
                <rect x={x - groupW / 2} y={padTop} width={groupW} height={plotH} fill="transparent" />
                {d.porcentaje > 0 && (
                  <circle
                    cx={x}
                    cy={y(d.porcentaje)}
                    r={isHovered ? 4.5 : 3}
                    fill={COLOR}
                  />
                )}
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
        </svg>

        {hover && (
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs shadow-sm">
            <span className="font-medium text-stone-800">{hover.etiqueta}</span>
            <span className="text-stone-500"> · Postura: </span>
            <span className="font-medium text-stone-800">
              {hover.porcentaje > 0 ? `${hover.porcentaje.toFixed(1)}%` : "sin dato"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
