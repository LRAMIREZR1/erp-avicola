import { createClient } from "@/lib/supabase/server";
import { formatCLP, hoyChile, sumarDias } from "@/lib/format";
import { requireRol } from "@/lib/roles";
import StatCard from "@/components/StatCard";
import FiltroPanelVentas from "@/components/FiltroPanelVentas";
import VentasSemanaChart, { type VentaSemanaDatum } from "@/components/VentasSemanaChart";

export const dynamic = "force-dynamic";

const OPCIONES_SEMANAS = [4, 8, 12, 26];
const SEMANAS_DEFECTO = 8;

interface FilaPedido {
  id: string;
  cliente_id: string;
  total: number;
  fecha_pedido: string;
  clientes: { nombre: string; zona_entrega: string | null } | null;
}

// Lunes de la semana calendario a la que pertenece "fecha" (YYYY-MM-DD). Se
// opera en UTC "de mentira" (misma técnica que sumarDias en lib/format) para
// no depender de la zona horaria del servidor.
function inicioSemana(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  const diaSemana = d.getUTCDay(); // 0 = domingo, 1 = lunes, ... 6 = sábado
  const diasDesdeElLunes = diaSemana === 0 ? 6 : diaSemana - 1;
  d.setUTCDate(d.getUTCDate() - diasDesdeElLunes);
  return d.toISOString().slice(0, 10);
}

// "1 sept – 7 sept" a partir del lunes de la semana.
function formatRangoSemana(inicioLunes: string): string {
  const fin = sumarDias(inicioLunes, 6);
  const fmt = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" });
  return `${fmt.format(new Date(`${inicioLunes}T00:00:00Z`))} – ${fmt.format(new Date(`${fin}T00:00:00Z`))}`;
}

// "1 sept" — etiqueta corta para el eje X del gráfico (solo el inicio).
function formatEtiquetaSemana(inicioLunes: string): string {
  const fmt = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" });
  return fmt.format(new Date(`${inicioLunes}T00:00:00Z`));
}

function formatCambioSemana(actual: number, anterior: number) {
  if (anterior <= 0) {
    return actual > 0
      ? { texto: "Nueva", clase: "text-stone-500" }
      : { texto: "—", clase: "text-stone-400" };
  }
  const cambio = ((actual - anterior) / anterior) * 100;
  const signo = cambio >= 0 ? "+" : "";
  const clase = cambio > 0 ? "text-green-700" : cambio < 0 ? "text-red-600" : "text-stone-500";
  return { texto: `${signo}${cambio.toFixed(1)}%`, clase };
}

// Panel pensado para que Luis vea, de un vistazo, cómo viene la semana
// (no solo un total del mes), quiénes son sus mejores clientes y en qué
// zonas conviene reforzar el reparto o la promoción.
export default async function PanelVentasPage({
  searchParams,
}: {
  searchParams: Promise<{ semanas?: string }>;
}) {
  await requireRol(["administrador"]);
  const params = await searchParams;
  const semanasNum = OPCIONES_SEMANAS.includes(Number(params.semanas))
    ? Number(params.semanas)
    : SEMANAS_DEFECTO;

  const hoy = hoyChile();
  const inicioActual = inicioSemana(hoy);
  // Primera semana que se muestra en la tabla.
  const desdeVisible = sumarDias(inicioActual, -(semanasNum - 1) * 7);
  // Una semana extra antes de la visible, solo para poder calcular la
  // variación % de esa primera semana mostrada (mismo criterio que se usa
  // en Indicadores de producción).
  const desdeConsulta = sumarDias(desdeVisible, -7);

  const supabase = await createClient();
  const { data } = await supabase
    .from("pedidos")
    .select("id, cliente_id, total, fecha_pedido, clientes(nombre, zona_entrega)")
    .neq("estado", "cancelado")
    .neq("estado", "eliminado")
    .gte("fecha_pedido", desdeConsulta)
    .lte("fecha_pedido", hoy);

  const pedidos = (data ?? []) as unknown as FilaPedido[];

  // Agrupa por semana (lunes de inicio) toda la ventana consultada,
  // incluyendo la semana extra que solo sirve de base de comparación.
  const porSemana = new Map<string, { total: number; pedidos: number }>();
  for (const p of pedidos) {
    const semana = inicioSemana(p.fecha_pedido);
    const actual = porSemana.get(semana) ?? { total: 0, pedidos: 0 };
    actual.total += Number(p.total);
    actual.pedidos += 1;
    porSemana.set(semana, actual);
  }

  const semanasTodas: string[] = [];
  for (let s = desdeConsulta; s <= inicioActual; s = sumarDias(s, 7)) {
    semanasTodas.push(s);
  }
  const filasSemana = semanasTodas.slice(1).map((semana, i) => {
    const semanaAnterior = semanasTodas[i]; // i, no i+1: semanasTodas incluye la extra al inicio
    const datos = porSemana.get(semana) ?? { total: 0, pedidos: 0 };
    const datosAnterior = porSemana.get(semanaAnterior) ?? { total: 0, pedidos: 0 };
    return {
      semana,
      ...datos,
      cambio: formatCambioSemana(datos.total, datosAnterior.total),
      esActual: semana === inicioActual,
    };
  });

  // Todo lo que sigue (rankings, totales) se calcula solo sobre la ventana
  // visible, sin la semana extra de comparación.
  const pedidosVisibles = pedidos.filter((p) => inicioSemana(p.fecha_pedido) >= desdeVisible);
  const totalPeriodo = pedidosVisibles.reduce((acc, p) => acc + Number(p.total), 0);
  const cantidadPedidos = pedidosVisibles.length;
  const clientesActivos = new Set(pedidosVisibles.map((p) => p.cliente_id)).size;
  const ticketPromedio = cantidadPedidos > 0 ? totalPeriodo / cantidadPedidos : 0;

  const porCliente = new Map<string, { nombre: string; total: number; pedidos: number }>();
  for (const p of pedidosVisibles) {
    const nombre = p.clientes?.nombre ?? "Cliente";
    const actual = porCliente.get(p.cliente_id) ?? { nombre, total: 0, pedidos: 0 };
    actual.total += Number(p.total);
    actual.pedidos += 1;
    porCliente.set(p.cliente_id, actual);
  }
  const rankingClientes = [...porCliente.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  const datosGrafico: VentaSemanaDatum[] = filasSemana.map((f) => ({
    semana: f.semana,
    etiqueta: formatEtiquetaSemana(f.semana),
    rango: formatRangoSemana(f.semana),
    total: f.total,
    pedidos: f.pedidos,
    esActual: f.esActual,
  }));

  const porZona = new Map<string, number>();
  for (const p of pedidosVisibles) {
    const zona = p.clientes?.zona_entrega?.trim() || "Sin zona registrada";
    porZona.set(zona, (porZona.get(zona) ?? 0) + Number(p.total));
  }
  const rankingZonas = [...porZona.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Panel de control de ventas</h1>
        <p className="text-sm text-stone-500">No incluye pedidos cancelados ni eliminados</p>
      </div>

      <FiltroPanelVentas valorActual={semanasNum} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total vendido"
          value={formatCLP(totalPeriodo)}
          hint={`Últimas ${semanasNum} semanas`}
        />
        <StatCard label="Pedidos" value={cantidadPedidos} hint="No cancelados" />
        <StatCard label="Ticket promedio" value={formatCLP(ticketPromedio)} />
        <StatCard label="Clientes activos" value={clientesActivos} hint="Compraron en el período" />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-stone-700">Tendencia semanal de ventas</p>
        <VentasSemanaChart data={datosGrafico} />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-stone-700">Ventas por semana</p>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-stone-500">
                <th className="whitespace-nowrap py-2 pr-3 font-medium">Semana</th>
                <th className="whitespace-nowrap py-2 px-3 text-right font-medium">Pedidos</th>
                <th className="whitespace-nowrap py-2 px-3 text-right font-medium">Total</th>
                <th className="whitespace-nowrap py-2 pl-3 text-right font-medium">
                  Vs. semana anterior
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filasSemana.map((f) => (
                <tr key={f.semana}>
                  <td className="whitespace-nowrap py-2 pr-3 text-stone-700">
                    {formatRangoSemana(f.semana)}
                    {f.esActual && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Esta semana
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2 px-3 text-right text-stone-600">
                    {f.pedidos}
                  </td>
                  <td className="whitespace-nowrap py-2 px-3 text-right font-semibold text-stone-800">
                    {formatCLP(f.total)}
                  </td>
                  <td
                    className={`whitespace-nowrap py-2 pl-3 text-right font-medium ${f.cambio.clase}`}
                  >
                    {f.cambio.texto}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-stone-700">Clientes que más compraron</p>
          {rankingClientes.length === 0 ? (
            <p className="py-4 text-center text-sm text-stone-400">Sin datos en el período</p>
          ) : (
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-stone-500">
                    <th className="whitespace-nowrap py-2 pr-3 font-medium">#</th>
                    <th className="whitespace-nowrap py-2 px-3 font-medium">Cliente</th>
                    <th className="whitespace-nowrap py-2 px-3 text-right font-medium">Pedidos</th>
                    <th className="whitespace-nowrap py-2 pl-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rankingClientes.map((c, i) => (
                    <tr key={c.nombre + i}>
                      <td className="whitespace-nowrap py-2 pr-3 text-stone-400">{i + 1}</td>
                      <td className="whitespace-nowrap py-2 px-3 text-stone-700">{c.nombre}</td>
                      <td className="whitespace-nowrap py-2 px-3 text-right text-stone-600">
                        {c.pedidos}
                      </td>
                      <td className="whitespace-nowrap py-2 pl-3 text-right font-semibold text-stone-800">
                        {formatCLP(c.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-stone-700">Ventas por zona de entrega</p>
          <div className="divide-y divide-stone-100">
            {rankingZonas.map(([zona, total]) => (
              <div key={zona} className="flex items-center justify-between py-2 text-sm">
                <span className="text-stone-600">{zona}</span>
                <span className="font-medium text-stone-800">{formatCLP(total)}</span>
              </div>
            ))}
            {rankingZonas.length === 0 && (
              <p className="py-4 text-center text-sm text-stone-400">Sin datos en el período</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
