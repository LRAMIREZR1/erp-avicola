"use client";

import { useState } from "react";

export interface StockChartDatum {
  categoria: string;
  bandejas: number;
  cajas: number;
}

const SERIES = [
  { key: "bandejas" as const, label: "Bandejas (30 un.)", color: "#2a78d6" },
  { key: "cajas" as const, label: "Cajas (120/180 un.)", color: "#eb6834" },
];

function nicerMax(value: number) {
  if (value <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const step = magnitude <= 1 ? 1 : magnitude / 2;
  return Math.ceil(value / step) * step;
}

export default function StockChart({ data }: { data: StockChartDatum[] }) {
  const [hover, setHover] = useState<{ categoria: string; serieLabel: string; valor: number } | null>(
    null
  );

  const maxValor = Math.max(1, ...data.map((d) => Math.max(d.bandejas, d.cajas)));
  const niceMax = nicerMax(maxValor);
  const totalBandejas = data.reduce((acc, d) => acc + d.bandejas, 0);
  const totalCajas = data.reduce((acc, d) => acc + d.cajas, 0);
  const totalPorSerie: Record<"bandejas" | "cajas", number> = {
    bandejas: totalBandejas,
    cajas: totalCajas,
  };
  const ticks = [0, niceMax * 0.25, niceMax * 0.5, niceMax * 0.75, niceMax];

  const width = 560;
  const height = 220;
  const padLeft = 40;
  const padBottom = 28;
  const padTop = 12;
  const plotW = width - padLeft - 16;
  const plotH = height - padBottom - padTop;

  const groupW = plotW / Math.max(1, data.length);
  const barW = Math.min(24, groupW / 4);
  const barGap = 4;

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
              style={{ backgroundColor: s.color }}
            />
            {s.label}
            <span className="font-semibold text-stone-800">
              {totalPorSerie[s.key]} disponibles
            </span>
          </div>
        ))}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          role="img"
          aria-label="Stock disponible por categoría, dividido en bandejas y cajas"
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
            return (
              <g key={d.categoria}>
                {SERIES.map((s, si) => {
                  const valor = d[s.key];
                  const barH = plotH - (y(valor) - padTop);
                  const x = groupX - barW - barGap / 2 + si * (barW + barGap);
                  const isHovered =
                    hover?.categoria === d.categoria && hover?.serieLabel === s.label;
                  return (
                    <g
                      key={s.key}
                      onMouseEnter={() =>
                        setHover({ categoria: d.categoria, serieLabel: s.label, valor })
                      }
                      onMouseLeave={() => setHover(null)}
                      style={{ cursor: "pointer" }}
                    >
                      <rect
                        x={x}
                        y={y(valor)}
                        width={barW}
                        height={Math.max(0, barH)}
                        rx={4}
                        fill={s.color}
                        opacity={isHovered ? 1 : 0.9}
                      />
                      <text
                        x={x + barW / 2}
                        y={y(valor) - 4}
                        textAnchor="middle"
                        fontSize={10}
                        fill="#52514e"
                      >
                        {valor}
                      </text>
                    </g>
                  );
                })}
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
            <span className="text-stone-500"> · {hover.serieLabel}: </span>
            <span className="font-medium text-stone-800">{hover.valor} disponibles</span>
          </div>
        )}
      </div>
    </div>
  );
}
