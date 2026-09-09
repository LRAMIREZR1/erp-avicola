"use client";

import { useState } from "react";

export interface ProduccionCajasDatum {
  // Fecha YYYY-MM-DD (hora Chile).
  fecha: string;
  // Etiqueta corta para el eje X (ej. "lun 8").
  etiqueta: string;
  caja120: number;
  caja180: number;
}

const SERIES = [
  { key: "caja120" as const, label: "Caja de 120", opacity: 0.9 },
  { key: "caja180" as const, label: "Caja de 180", opacity: 0.5 },
];

// Mismo naranja que usan StockChart/StockFisicoChart para "cajas", para que
// todos los gráficos de la app se lean como un mismo sistema visual.
const COLOR_CAJAS = "#eb6834";

function nicerMax(value: number) {
  if (value <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const step = magnitude <= 1 ? 1 : magnitude / 2;
  return Math.ceil(value / step) * step;
}

interface HoverInfo {
  fecha: string;
  etiqueta: string;
  caja120: number;
  caja180: number;
}

// Barras apiladas por día: caja_120 (tramo sólido, abajo) + caja_180 (tramo
// más claro, arriba) = total de cajas producidas ese día. Una línea punteada
// marca el promedio del período, para ver de un vistazo si un día quedó por
// debajo o por encima de lo habitual.
export default function ProduccionCajasChart({ data }: { data: ProduccionCajasDatum[] }) {
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const totales = data.map((d) => d.caja120 + d.caja180);
  const maxValor = Math.max(1, ...totales);
  const niceMax = nicerMax(maxValor);
  const promedio = data.length > 0 ? totales.reduce((acc, t) => acc + t, 0) / data.length : 0;
  const ticks = [0, niceMax * 0.25, niceMax * 0.5, niceMax * 0.75, niceMax];

  const width = 620;
  const height = 240;
  const padLeft = 40;
  const padBottom = 28;
  const padTop = 12;
  const plotW = width - padLeft - 16;
  const plotH = height - padBottom - padTop;

  const groupW = plotW / Math.max(1, data.length);
  const barW = Math.min(28, groupW * 0.55);

  function y(valor: number) {
    return padTop + plotH - (valor / niceMax) * plotH;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-stone-600">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: COLOR_CAJAS, opacity: s.opacity }}
            />
            {s.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-stone-600">
          <span className="inline-block h-0 w-3.5 border-t-2 border-dashed border-stone-400" />
          Promedio del período
          <span className="font-semibold text-stone-800">
            {promedio.toLocaleString("es-CL", { maximumFractionDigits: 1 })} cajas/día
          </span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          role="img"
          aria-label="Producción diaria de cajas, últimos días"
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
          <line x1={padLeft} x2={width - 8} y1={y(0)} y2={y(0)} stroke="#c3c2b7" strokeWidth={1} />

          {/* línea de promedio */}
          {promedio > 0 && (
            <line
              x1={padLeft}
              x2={width - 8}
              y1={y(promedio)}
              y2={y(promedio)}
              stroke="#78766f"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          )}

          {data.map((d, i) => {
            const total = d.caja120 + d.caja180;
            const x = padLeft + i * groupW + (groupW - barW) / 2;
            const isHovered = hover?.fecha === d.fecha;
            return (
              <g
                key={d.fecha}
                onMouseEnter={() =>
                  setHover({ fecha: d.fecha, etiqueta: d.etiqueta, caja120: d.caja120, caja180: d.caja180 })
                }
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Tramo caja_120 (abajo) */}
                <rect
                  x={x}
                  y={y(d.caja120)}
                  width={barW}
                  height={Math.max(0, y(0) - y(d.caja120))}
                  fill={COLOR_CAJAS}
                  opacity={isHovered ? 1 : 0.9}
                />
                {/* Tramo caja_180 (arriba, tono más claro) */}
                {d.caja180 > 0 && (
                  <rect
                    x={x}
                    y={y(total)}
                    width={barW}
                    height={Math.max(0, y(d.caja120) - y(total))}
                    fill={COLOR_CAJAS}
                    opacity={isHovered ? 0.7 : 0.5}
                  />
                )}
                {total > 0 && (
                  <text
                    x={x + barW / 2}
                    y={y(total) - 4}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#52514e"
                  >
                    {total}
                  </text>
                )}
                <text
                  x={x + barW / 2}
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
            <span className="text-stone-500"> · Caja 120: </span>
            <span className="font-medium text-stone-800">{hover.caja120}</span>
            <span className="text-stone-500"> · Caja 180: </span>
            <span className="font-medium text-stone-800">{hover.caja180}</span>
          </div>
        )}
      </div>
    </div>
  );
}
