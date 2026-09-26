import { formatCLP, formatFecha } from "@/lib/format";
import type { Categoria } from "@/lib/supabase/types";

// Componente puro (sin estado, sin JS en el navegador) que dibuja un
// gráfico de líneas en SVG a mano, sin depender de ninguna librería externa
// — así no hay que tocar package.json ni instalar nada nuevo.

export interface PuntoPrecio {
  semana: string; // YYYY-MM-DD
  precio: number;
}

export interface SerieProducto {
  productoId: string;
  nombre: string;
  categoria: Categoria;
  puntos: PuntoPrecio[]; // ya ordenados cronológicamente, uno por semana en la que hay dato
}

// Mismo color para la misma categoría siempre, en Bandejas y en Cajas.
const COLOR_CATEGORIA: Record<Categoria, string> = {
  super_extra: "#a855f7",
  extra: "#f59e0b",
  primera: "#16a34a",
  segunda: "#0ea5e9",
  tercera: "#dc2626",
};

export default function GraficoEvolucionPrecios({
  titulo,
  semanas,
  series,
}: {
  titulo: string;
  semanas: string[]; // eje X, ascendente (de la más antigua a la más reciente)
  series: SerieProducto[];
}) {
  if (semanas.length < 2 || series.length === 0) {
    return (
      <div className="mt-5 first:mt-0">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
          {titulo}
        </p>
        <p className="text-xs text-stone-400">
          Todavía no hay suficientes semanas guardadas para esta sección.
        </p>
      </div>
    );
  }

  const ancho = 640;
  const alto = 220;
  const margen = { top: 12, right: 16, bottom: 28, left: 56 };
  const anchoUtil = ancho - margen.left - margen.right;
  const altoUtil = alto - margen.top - margen.bottom;

  const todosLosPrecios = series.flatMap((s) => s.puntos.map((p) => p.precio));
  const precioMin = Math.min(...todosLosPrecios);
  const precioMax = Math.max(...todosLosPrecios);
  const rango = precioMax - precioMin || precioMax || 1;
  const yPadding = rango * 0.1;
  const yMin = Math.max(0, precioMin - yPadding);
  const yMax = precioMax + yPadding;

  const indicesPorSemana = new Map(semanas.map((s, i) => [s, i]));

  const x = (idx: number) =>
    margen.left + (semanas.length === 1 ? 0 : (idx / (semanas.length - 1)) * anchoUtil);
  const y = (precio: number) =>
    margen.top + altoUtil - ((precio - yMin) / (yMax - yMin || 1)) * altoUtil;

  // 4 líneas guía horizontales con su etiqueta de precio.
  const marcasY = [0, 1, 2, 3, 4].map((i) => yMin + ((yMax - yMin) * i) / 4);

  return (
    <div className="mt-5 first:mt-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
        {titulo}
      </p>
      <div className="-mx-4 overflow-x-auto px-4">
        <svg
          viewBox={`0 0 ${ancho} ${alto}`}
          className="w-full min-w-[560px]"
          role="img"
          aria-label={`Gráfico de evolución de precios — ${titulo}`}
        >
          {marcasY.map((valor, i) => (
            <g key={i}>
              <line
                x1={margen.left}
                x2={ancho - margen.right}
                y1={y(valor)}
                y2={y(valor)}
                stroke="#e7e5e4"
                strokeWidth={1}
              />
              <text
                x={margen.left - 6}
                y={y(valor)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={9}
                fill="#a8a29e"
              >
                {formatCLP(Math.round(valor))}
              </text>
            </g>
          ))}

          {semanas.map((semana, i) => (
            <text
              key={semana}
              x={x(i)}
              y={alto - margen.bottom + 14}
              textAnchor="middle"
              fontSize={9}
              fill="#a8a29e"
            >
              {formatFecha(semana).slice(0, 6)}
            </text>
          ))}

          {series.map((serie) => {
            const color = COLOR_CATEGORIA[serie.categoria] ?? "#78716c";

            // Separar en tramos continuos, para que se corte la línea (en
            // vez de unir con una recta rara) cuando falte una semana.
            const segmentos: PuntoPrecio[][] = [];
            let actual: PuntoPrecio[] = [];
            let idxAnterior: number | null = null;
            for (const punto of serie.puntos) {
              const idx = indicesPorSemana.get(punto.semana);
              if (idx == null) continue;
              if (idxAnterior != null && idx !== idxAnterior + 1) {
                if (actual.length > 0) segmentos.push(actual);
                actual = [];
              }
              actual.push(punto);
              idxAnterior = idx;
            }
            if (actual.length > 0) segmentos.push(actual);

            return (
              <g key={serie.productoId}>
                {segmentos.map((segmento, si) => (
                  <polyline
                    key={si}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    points={segmento
                      .map((p) => `${x(indicesPorSemana.get(p.semana)!)},${y(p.precio)}`)
                      .join(" ")}
                  />
                ))}
                {serie.puntos.map((p) => {
                  const idx = indicesPorSemana.get(p.semana);
                  if (idx == null) return null;
                  return (
                    <circle key={p.semana} cx={x(idx)} cy={y(p.precio)} r={3} fill={color}>
                      <title>{`${serie.nombre} — semana del ${formatFecha(p.semana)}: ${formatCLP(p.precio)}`}</title>
                    </circle>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((serie) => (
          <div key={serie.productoId} className="flex items-center gap-1.5 text-xs text-stone-600">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: COLOR_CATEGORIA[serie.categoria] ?? "#78716c" }}
            />
            {serie.nombre}
          </div>
        ))}
      </div>
    </div>
  );
}
