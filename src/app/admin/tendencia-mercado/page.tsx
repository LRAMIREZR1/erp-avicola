import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/roles";
import GraficoEvolucionPrecios, {
  type SerieProducto,
} from "@/components/GraficoEvolucionPrecios";
import type { Categoria, Formato } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

interface FilaSugerencia {
  id: string;
  semana_fecha: string;
  precio_actual: number;
  producto_id: string;
  productos: { nombre: string; formato: Formato; categoria: Categoria } | null;
}

// Mismo orden de calidad que en "Precio de mercado": Super Extra, Extra,
// Primera, Segunda, Tercera.
const ORDEN_CATEGORIA: Record<Categoria, number> = {
  super_extra: 0,
  extra: 1,
  primera: 2,
  segunda: 3,
  tercera: 4,
};

// Tope de semanas que se muestran en el gráfico, para que no se sature de
// líneas ni de etiquetas en el eje X cuando ya haya mucho historial.
const MAX_SEMANAS_GRAFICO = 20;

function construirSeries(filas: FilaSugerencia[], semanas: string[]): SerieProducto[] {
  const semanasSet = new Set(semanas);
  const porProducto = new Map<string, SerieProducto>();

  for (const f of filas) {
    if (!f.productos || !semanasSet.has(f.semana_fecha)) continue;
    if (!porProducto.has(f.producto_id)) {
      porProducto.set(f.producto_id, {
        productoId: f.producto_id,
        nombre: f.productos.nombre,
        categoria: f.productos.categoria,
        puntos: [],
      });
    }
    porProducto.get(f.producto_id)!.puntos.push({
      semana: f.semana_fecha,
      precio: f.precio_actual,
    });
  }

  const series = Array.from(porProducto.values()).map((serie) => ({
    ...serie,
    puntos: [...serie.puntos].sort((a, b) => (a.semana < b.semana ? -1 : 1)),
  }));

  return series.sort(
    (a, b) => (ORDEN_CATEGORIA[a.categoria] ?? 99) - (ORDEN_CATEGORIA[b.categoria] ?? 99)
  );
}

// Página informativa: muestra cómo ha ido subiendo o bajando tu propio
// precio (el que estaba vigente cada semana), separado por Bandejas y
// Cajas y con una línea por categoría — usando el mismo historial semanal
// que ya se guarda para "Precio de mercado del huevo".
export default async function TendenciaMercadoPage() {
  await requireRol(["administrador"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("sugerencias_precio")
    .select("id, semana_fecha, precio_actual, producto_id, productos(nombre, formato, categoria)")
    .order("semana_fecha", { ascending: false })
    .limit(1000);

  const filas = (data ?? []) as unknown as FilaSugerencia[];

  const semanasDisponibles = Array.from(new Set(filas.map((f) => f.semana_fecha))).sort((a, b) =>
    a < b ? 1 : a > b ? -1 : 0
  ); // de la más reciente a la más antigua

  const semanasGrafico = [...semanasDisponibles].slice(0, MAX_SEMANAS_GRAFICO).reverse(); // ascendente

  const seriesBandejas = construirSeries(
    filas.filter((f) => f.productos?.formato === "bandeja_30"),
    semanasGrafico
  );
  const seriesCajas = construirSeries(
    filas.filter((f) => f.productos?.formato !== "bandeja_30"),
    semanasGrafico
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Tendencia de mercado</h1>
        <p className="text-sm text-stone-500">
          Cómo ha ido subiendo o bajando tu propio precio, semana a semana, por categoría —
          usando el historial de &quot;Precio de mercado del huevo&quot;
        </p>
      </div>

      {semanasGrafico.length < 2 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-sm text-stone-500">
            Todavía no hay suficientes semanas de reportes guardados para graficar una tendencia
            (se necesitan al menos 2). Esto se va a ir llenando solo, semana a semana, a medida
            que corra la sugerencia automática de precios.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <GraficoEvolucionPrecios
            titulo="Bandejas (30 unidades)"
            semanas={semanasGrafico}
            series={seriesBandejas}
          />
          <GraficoEvolucionPrecios titulo="Cajas" semanas={semanasGrafico} series={seriesCajas} />
        </div>
      )}
    </div>
  );
}
