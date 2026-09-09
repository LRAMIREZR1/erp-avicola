"use client";

import { useState } from "react";

export interface ProduccionCajasDatum {
  // Fecha YYYY-MM-DD (hora Chile).
  fecha: string;
  // Etiqueta corta para el eje X (ej. "lun 8").
  etiqueta: string;
  caja120: number;
  caja180: number;
  // Total de huevos recolectados ese día (dato manual, aparte de las
  // cajas/bandejas). 0 significa "no se registró ese día", no "cero
  // producción" — así que esos días quedan como hueco en la línea, no como
  // una caída a cero.
  totalHuevos: number;
  // Huevos rotos ese día. Se grafica como punto sobre el eje de cajas (misma
  // magnitud que las cajas producidas, muy por debajo del total de huevos
  // recolectados) — solo se dibuja el punto cuando hay dato (> 0), ya que un
  // día sin registro tampoco se distingue de "cero rotos".
  huevosRotos: number;
}

const SERIES = [
  { key: "caja120" as const, label: "Caja de 120", opacity: 0.9 },
  { key: "caja180" as const, label: "Caja de 180", opacity: 0.5 },
];

// Mismo naranja que usan StockChart/StockFisicoChart para "cajas", para que
// todos los gráficos de la app se lean como un mismo sistema visual.
const COLOR_CAJAS = "#eb6834";
// Mismo índigo que usa la app para "Confirmado" en pedidos — se eligió para
// que se distinga con claridad del naranja de las cajas, ya que esta línea
// se superpone a las barras.
const COLOR_HUEVOS = "#4f46e5";
// Mismo rojo que usa la app para "mermas"/estados de peligro (tone="danger"),
// para que se lea igual que en las demás pantallas.
const COLOR_ROTOS = "#dc2626";

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
  totalHuevos: number;
  huevosRotos: number;
}

// Barras apiladas por día: caja_120 (tramo sólido, abajo) + caja_180 (tramo
// más claro, arriba) = total de cajas producidas ese día. Una línea punteada
// gris marca el promedio del período (misma escala que las barras). Otra
// línea punteada, índigo y con su propio eje a la derecha, traza el total
// de huevos recolectados por día — va en un eje aparte porque la magnitud
// (cientos/miles de huevos) no tiene nada que ver con la cantidad de cajas.
// Puntos rojos marcan los huevos rotos de cada día, sobre el eje izquierdo
// (misma escala que las cajas, ya que su magnitud es comparable).
export default function ProduccionCajasChart({ data }: { data: ProduccionCajasDatum[] }) {
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const totales = data.map((d) => d.caja120 + d.caja180);
  // El eje izquierdo también tiene que alcanzar para los puntos de huevos
  // rotos, por si algún día superan la cantidad de cajas.
  const maxValor = Math.max(1, ...totales, ...data.map((d) => d.huevosRotos));
  const niceMax = nicerMax(maxValor);
  const promedio = data.length > 0 ? totales.reduce((acc, t) => acc + t, 0) / data.length : 0;
  const ticks = [0, niceMax * 0.25, niceMax * 0.5, niceMax * 0.75, niceMax];
  const hayRotos = data.some((d) => d.huevosRotos > 0);

  const maxHuevos = Math.max(1, ...data.map((d) => d.totalHuevos));
  const niceMaxHuevos = nicerMax(maxHuevos);
  const hayHuevos = data.some((d) => d.totalHuevos > 0);
  const ticksHuevos = [0, niceMaxHuevos * 0.25, niceMaxHuevos * 0.5, niceMaxHuevos * 0.75, niceMaxHuevos];

  const width = 620;
  const height = 240;
  const padLeft = 40;
  const padRight = hayHuevos ? 48 : 16;
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

  function yHuevos(valor: number) {
    return padTop + plotH - (valor / niceMaxHuevos) * plotH;
  }

  // Conecta con una línea solo los días que sí tienen dato — los días sin
  // registro quedan como un hueco, en vez de dibujar una caída falsa a 0.
  const segmentosHuevos: { x: number; y: number }[][] = [];
  let segmentoActual: { x: number; y: number }[] = [];
  data.forEach((d, i) => {
    if (d.totalHuevos > 0) {
      segmentoActual.push({ x: padLeft + i * groupW + groupW / 2, y: yHuevos(d.totalHuevos) });
    } else if (segmentoActual.length > 0) {
      segmentosHuevos.push(segmentoActual);
      segmentoActual = [];
    }
  });
  if (segmentoActual.length > 0) segmentosHuevos.push(segmentoActual);

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
        {hayHuevos && (
          <div className="flex items-center gap-1.5 text-xs text-stone-600">
            <span
              className="inline-block h-0 w-3.5 border-t-2 border-dotted"
              style={{ borderColor: COLOR_HUEVOS }}
            />
            Total de huevos recolectados (eje derecho)
          </div>
        )}
        {hayRotos && (
          <div className="flex items-center gap-1.5 text-xs text-stone-600">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: COLOR_ROTOS }}
            />
            Huevos rotos (eje izquierdo)
          </div>
        )}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          role="img"
          aria-label="Producción diaria de cajas y total de huevos recolectados, últimos días"
        >
          {/* gridlines (escala de cajas, eje izquierdo) */}
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
          {/* baseline */}
          <line x1={padLeft} x2={plotRight} y1={y(0)} y2={y(0)} stroke="#c3c2b7" strokeWidth={1} />

          {/* línea de promedio (cajas) */}
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

          {/* eje derecho (escala de huevos totales) */}
          {hayHuevos &&
            ticksHuevos.map((t) => (
              <text
                key={t}
                x={plotRight + 8}
                y={yHuevos(t) + 3}
                textAnchor="start"
                fontSize={10}
                fill="#898781"
              >
                {Math.round(t).toLocaleString("es-CL")}
              </text>
            ))}

          {data.map((d, i) => {
            const total = d.caja120 + d.caja180;
            const x = padLeft + i * groupW + (groupW - barW) / 2;
            const isHovered = hover?.fecha === d.fecha;
            return (
              <g
                key={d.fecha}
                onMouseEnter={() =>
                  setHover({
                    fecha: d.fecha,
                    etiqueta: d.etiqueta,
                    caja120: d.caja120,
                    caja180: d.caja180,
                    totalHuevos: d.totalHuevos,
                    huevosRotos: d.huevosRotos,
                  })
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

          {/* puntos de huevos rotos (eje izquierdo, misma escala que las
              cajas) — solo se marca el punto cuando ese día tiene dato */}
          {data.map((d, i) => {
            if (d.huevosRotos <= 0) return null;
            const cx = padLeft + i * groupW + groupW / 2;
            const cy = y(d.huevosRotos);
            const isHovered = hover?.fecha === d.fecha;
            return (
              <circle
                key={`roto-${d.fecha}`}
                cx={cx}
                cy={cy}
                r={isHovered ? 4.5 : 3}
                fill={COLOR_ROTOS}
                stroke="white"
                strokeWidth={1}
                onMouseEnter={() =>
                  setHover({
                    fecha: d.fecha,
                    etiqueta: d.etiqueta,
                    caja120: d.caja120,
                    caja180: d.caja180,
                    totalHuevos: d.totalHuevos,
                    huevosRotos: d.huevosRotos,
                  })
                }
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              />
            );
          })}

          {/* línea de huevos totales (eje derecho), en tramos: se corta en
              los días sin dato en vez de bajar a 0 */}
          {segmentosHuevos.map((seg, si) => (
            <polyline
              key={si}
              points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={COLOR_HUEVOS}
              strokeWidth={2}
              strokeDasharray="1 4"
              strokeLinecap="round"
            />
          ))}
          {data.map((d, i) => {
            if (d.totalHuevos <= 0) return null;
            const cx = padLeft + i * groupW + groupW / 2;
            const cy = yHuevos(d.totalHuevos);
            const isHovered = hover?.fecha === d.fecha;
            return (
              <circle
                key={`huevo-${d.fecha}`}
                cx={cx}
                cy={cy}
                r={isHovered ? 4 : 3}
                fill={COLOR_HUEVOS}
                onMouseEnter={() =>
                  setHover({
                    fecha: d.fecha,
                    etiqueta: d.etiqueta,
                    caja120: d.caja120,
                    caja180: d.caja180,
                    totalHuevos: d.totalHuevos,
                    huevosRotos: d.huevosRotos,
                  })
                }
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              />
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
            {hover.totalHuevos > 0 && (
              <>
                <span className="text-stone-500"> · Huevos: </span>
                <span className="font-medium text-stone-800">
                  {hover.totalHuevos.toLocaleString("es-CL")}
                </span>
              </>
            )}
            {hover.huevosRotos > 0 && (
              <>
                <span className="text-stone-500"> · Rotos: </span>
                <span className="font-medium text-red-700">{hover.huevosRotos}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
