import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatFecha, hoyChile, sumarDias } from "@/lib/format";
import { requireRol } from "@/lib/roles";
import StatCard from "@/components/StatCard";
import { NOMBRES_FORMATO, type Formato } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// Debe coincidir con el motivo usado en produccion/actions.ts.
const MOTIVO_PRODUCCION = "Producción diaria";

const HUEVOS_POR_FORMATO: Record<Formato, number> = {
  bandeja_30: 30,
  caja_120: 120,
  caja_180: 180,
};
const FORMATOS: Formato[] = ["bandeja_30", "caja_120", "caja_180"];
const HORIZONTES = [7, 14, 30];

function diasEntre(desde: string, hasta: string) {
  const msPorDia = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / msPorDia);
}

function formatoVacio(): Record<Formato, number> {
  return { bandeja_30: 0, caja_120: 0, caja_180: 0 };
}

type OrdenCliente = {
  fecha: string;
  unidades: number;
  porFormato: Record<Formato, number>;
};

type PatronCliente = {
  clienteId: string;
  nombre: string;
  cantidadPedidos: number;
  promedioIntervaloDias: number;
  cantidadPromedioPorFormato: Record<Formato, number>;
  fechaUltimoPedido: string;
  proximaFechaEstimada: string;
  diasDesdeUltimoPedido: number;
  ratioAtraso: number;
  tendencia: "subiendo" | "bajando" | "estable";
};

// Texto compacto tipo "2.3 cajas de 180, 1 bandeja de 30" con los formatos
// que el cliente efectivamente compra (se omiten los que da 0).
function resumenFormatos(cantidades: Record<Formato, number>) {
  const partes = FORMATOS.filter((f) => cantidades[f] >= 0.05).map(
    (f) => `${cantidades[f].toFixed(1)} ${NOMBRES_FORMATO[f].toLowerCase()}`
  );
  return partes.length > 0 ? partes.join(", ") : "—";
}

function estadoAtraso(ratio: number) {
  if (ratio >= 1.75) return { texto: "Muy atrasado", clase: "bg-red-100 text-red-700" };
  if (ratio >= 1) return { texto: "Atrasado", clase: "bg-amber-100 text-amber-700" };
  return { texto: "Al día", clase: "bg-green-100 text-green-700" };
}

function iconoTendencia(t: PatronCliente["tendencia"]) {
  if (t === "subiendo") return { texto: "↑ Subiendo", clase: "text-green-700" };
  if (t === "bajando") return { texto: "↓ Bajando", clase: "text-red-600" };
  return { texto: "→ Estable", clase: "text-stone-500" };
}

export default async function DemandaPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  await requireRol(["administrador", "vendedor"]);
  const params = await searchParams;
  const horizonte = HORIZONTES.includes(Number(params.dias)) ? Number(params.dias) : 14;

  const supabase = await createClient();
  const hoy = hoyChile();

  const [{ data: pedidosData }, { data: movimientosData }, { data: clientesActivosData }] =
    await Promise.all([
      supabase
        .from("pedidos")
        .select(
          "id, cliente_id, fecha_pedido, clientes(nombre), pedido_items(cantidad, productos(formato))"
        )
        .eq("origen", "pedido")
        .neq("estado", "cancelado")
        .neq("estado", "eliminado")
        .order("fecha_pedido", { ascending: true }),
      // Producción real de los últimos 14 días, para estimar cuánto se está
      // produciendo por día y proyectarlo al horizonte elegido.
      supabase
        .from("movimientos_stock")
        .select("cantidad, productos(formato)")
        .eq("motivo", MOTIVO_PRODUCCION)
        .gte("created_at", `${sumarDias(hoy, -14)}T00:00:00Z`),
      supabase.from("clientes").select("id").eq("activo", true),
    ]);

  const idsActivos = new Set((clientesActivosData ?? []).map((c) => c.id));

  // Historial de pedidos agrupado por cliente, en orden cronológico (solo
  // clientes activos — a uno dado de baja no tiene sentido estimarle nada).
  const historialPorCliente = new Map<string, { nombre: string; ordenes: OrdenCliente[] }>();
  for (const p of pedidosData ?? []) {
    const clienteId = p.cliente_id as string;
    if (!idsActivos.has(clienteId)) continue;

    const nombre =
      (p as unknown as { clientes: { nombre: string } | null }).clientes?.nombre ?? "Cliente";
    const items =
      (
        p as unknown as {
          pedido_items: { cantidad: number; productos: { formato: Formato } | null }[] | null;
        }
      ).pedido_items ?? [];

    const porFormato = formatoVacio();
    let unidades = 0;
    for (const item of items) {
      const formato = item.productos?.formato;
      if (formato) porFormato[formato] += item.cantidad;
      unidades += item.cantidad;
    }

    const entrada = historialPorCliente.get(clienteId) ?? { nombre, ordenes: [] };
    entrada.ordenes.push({ fecha: p.fecha_pedido, unidades, porFormato });
    historialPorCliente.set(clienteId, entrada);
  }

  // Patrón de compra por cliente: cada cuánto pide y cuánto pide cada vez,
  // con promedio ponderado por recencia (los pedidos más recientes pesan
  // más, así que si el ritmo del cliente cambió hace poco, la estimación se
  // ajusta sin esperar meses de historial para notarlo). Se necesitan al
  // menos 2 pedidos para calcular un intervalo.
  const patrones: PatronCliente[] = [];
  let clientesSinPatron = 0;
  for (const [clienteId, { nombre, ordenes }] of historialPorCliente) {
    if (ordenes.length < 2) {
      clientesSinPatron++;
      continue;
    }

    const intervalos: number[] = [];
    for (let i = 1; i < ordenes.length; i++) {
      intervalos.push(diasEntre(ordenes[i - 1].fecha, ordenes[i].fecha));
    }
    let sumaPesos = 0;
    let sumaPonderada = 0;
    intervalos.forEach((dias, i) => {
      const peso = i + 1;
      sumaPonderada += dias * peso;
      sumaPesos += peso;
    });
    const promedioIntervaloDias = Math.max(1, Math.round(sumaPonderada / sumaPesos));

    const acumFormato = formatoVacio();
    let pesosCantidad = 0;
    ordenes.forEach((o, i) => {
      const peso = i + 1;
      pesosCantidad += peso;
      for (const formato of FORMATOS) acumFormato[formato] += o.porFormato[formato] * peso;
    });
    const cantidadPromedioPorFormato = formatoVacio();
    for (const formato of FORMATOS) {
      cantidadPromedioPorFormato[formato] = acumFormato[formato] / pesosCantidad;
    }

    // Tendencia: promedio simple de los últimos 3 pedidos vs. el promedio
    // histórico completo — si el cliente viene pidiendo notoriamente más (o
    // menos) que su promedio de siempre, se marca.
    const ultimasN = ordenes.slice(-Math.min(3, ordenes.length));
    const promedioReciente = ultimasN.reduce((acc, o) => acc + o.unidades, 0) / ultimasN.length;
    const promedioHistorico = ordenes.reduce((acc, o) => acc + o.unidades, 0) / ordenes.length;
    let tendencia: PatronCliente["tendencia"] = "estable";
    if (promedioHistorico > 0) {
      if (promedioReciente >= promedioHistorico * 1.15) tendencia = "subiendo";
      else if (promedioReciente <= promedioHistorico * 0.85) tendencia = "bajando";
    }

    const fechaUltimoPedido = ordenes[ordenes.length - 1].fecha;
    const proximaFechaEstimada = sumarDias(fechaUltimoPedido, promedioIntervaloDias);
    const diasDesdeUltimoPedido = diasEntre(fechaUltimoPedido, hoy);
    const ratioAtraso = diasDesdeUltimoPedido / promedioIntervaloDias;

    patrones.push({
      clienteId,
      nombre,
      cantidadPedidos: ordenes.length,
      promedioIntervaloDias,
      cantidadPromedioPorFormato,
      fechaUltimoPedido,
      proximaFechaEstimada,
      diasDesdeUltimoPedido,
      ratioAtraso,
      tendencia,
    });
  }

  patrones.sort((a, b) => a.proximaFechaEstimada.localeCompare(b.proximaFechaEstimada));
  const atrasados = [...patrones]
    .filter((p) => p.ratioAtraso >= 1)
    .sort((a, b) => b.ratioAtraso - a.ratioAtraso);

  // Proyección de demanda total para el horizonte elegido: por cada cliente,
  // cuántos pedidos se espera que haga en esos N días (según su ritmo) por
  // la cantidad promedio que pide cada vez.
  const demandaProyectada = formatoVacio();
  for (const p of patrones) {
    const pedidosEsperados = horizonte / p.promedioIntervaloDias;
    for (const formato of FORMATOS) {
      demandaProyectada[formato] += pedidosEsperados * p.cantidadPromedioPorFormato[formato];
    }
  }
  const demandaHuevos = FORMATOS.reduce(
    (acc, f) => acc + demandaProyectada[f] * HUEVOS_POR_FORMATO[f],
    0
  );

  // Producción reciente (últimos 14 días reales) extrapolada al horizonte
  // elegido, para poder comparar contra la demanda proyectada.
  const producidoPorFormato = formatoVacio();
  for (const m of movimientosData ?? []) {
    const formato = (m as unknown as { productos: { formato: Formato } | null }).productos?.formato;
    if (formato) producidoPorFormato[formato] += m.cantidad;
  }
  const produccionEstimada = formatoVacio();
  for (const formato of FORMATOS) {
    produccionEstimada[formato] = (producidoPorFormato[formato] / 14) * horizonte;
  }
  const produccionHuevos = FORMATOS.reduce(
    (acc, f) => acc + produccionEstimada[f] * HUEVOS_POR_FORMATO[f],
    0
  );

  const balanceHuevos = produccionHuevos - demandaHuevos;
  const alcanza = demandaHuevos === 0 || balanceHuevos >= 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Estimación de demanda</h1>
        <p className="text-sm text-stone-500">
          Basada en el ritmo de compra histórico de cada cliente (no incluye clientes inactivos)
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-stone-500">Horizonte:</span>
        {HORIZONTES.map((h) => (
          <Link
            key={h}
            href={`/admin/demanda?dias=${h}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              horizonte === h
                ? "bg-stone-800 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {h} días
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Clientes con patrón calculado"
          value={`${patrones.length}`}
          hint={
            clientesSinPatron > 0
              ? `${clientesSinPatron} con solo 1 pedido (falta historial)`
              : "con 2 o más pedidos"
          }
        />
        <StatCard
          label="Clientes atrasados"
          value={`${atrasados.length}`}
          tone={atrasados.length > 0 ? "warning" : "default"}
          hint="ya deberían haber vuelto a pedir"
        />
        <StatCard
          label={`Demanda proyectada (${horizonte} días)`}
          value={`${Math.round(demandaHuevos)} huevos`}
          hint={resumenFormatos(demandaProyectada)}
        />
        <StatCard
          label={`Producción estimada (${horizonte} días)`}
          value={`${Math.round(produccionHuevos)} huevos`}
          tone={alcanza ? "default" : "danger"}
          hint={alcanza ? "alcanza la demanda proyectada" : "no alcanzaría la demanda proyectada"}
        />
      </div>

      {!alcanza && demandaHuevos > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Con el ritmo de producción de los últimos 14 días, en {horizonte} días faltarían
          aproximadamente <strong>{Math.round(-balanceHuevos)} huevos</strong> para cubrir la
          demanda proyectada.
        </div>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-stone-700">
          Clientes atrasados ({atrasados.length})
        </p>
        {atrasados.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-400">
            No hay clientes atrasados según su ritmo habitual
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-stone-500">
                  <th className="whitespace-nowrap py-2 pr-3 font-medium">Cliente</th>
                  <th className="whitespace-nowrap py-2 px-3 font-medium">Último pedido</th>
                  <th className="whitespace-nowrap py-2 px-3 font-medium">Pide cada</th>
                  <th className="whitespace-nowrap py-2 px-3 font-medium">Debería haber pedido</th>
                  <th className="whitespace-nowrap py-2 pl-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {atrasados.map((p) => {
                  const estado = estadoAtraso(p.ratioAtraso);
                  return (
                    <tr key={p.clienteId}>
                      <td className="whitespace-nowrap py-2 pr-3 font-medium text-stone-800">
                        <Link
                          href={`/admin/pedidos?cliente_id=${p.clienteId}`}
                          className="hover:underline"
                        >
                          {p.nombre}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap py-2 px-3 text-stone-600">
                        {formatFecha(p.fechaUltimoPedido)}
                      </td>
                      <td className="whitespace-nowrap py-2 px-3 text-stone-600">
                        cada {p.promedioIntervaloDias} días
                      </td>
                      <td className="whitespace-nowrap py-2 px-3 text-stone-600">
                        hace {p.diasDesdeUltimoPedido - p.promedioIntervaloDias} días
                      </td>
                      <td className="whitespace-nowrap py-2 pl-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${estado.clase}`}
                        >
                          {estado.texto}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-stone-700">
          Patrón de compra por cliente ({patrones.length})
        </p>
        {patrones.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-400">
            Todavía no hay suficiente historial de pedidos para estimar patrones
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-stone-500">
                  <th className="whitespace-nowrap py-2 pr-3 font-medium">Cliente</th>
                  <th className="whitespace-nowrap py-2 px-3 font-medium">Pedidos</th>
                  <th className="whitespace-nowrap py-2 px-3 font-medium">Cada cuánto pide</th>
                  <th className="whitespace-nowrap py-2 px-3 font-medium">Cantidad promedio</th>
                  <th className="whitespace-nowrap py-2 px-3 font-medium">Próximo pedido estimado</th>
                  <th className="whitespace-nowrap py-2 px-3 font-medium">Tendencia</th>
                  <th className="whitespace-nowrap py-2 pl-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {patrones.map((p) => {
                  const estado = estadoAtraso(p.ratioAtraso);
                  const tendencia = iconoTendencia(p.tendencia);
                  return (
                    <tr key={p.clienteId}>
                      <td className="whitespace-nowrap py-2 pr-3 font-medium text-stone-800">
                        <Link
                          href={`/admin/pedidos?cliente_id=${p.clienteId}`}
                          className="hover:underline"
                        >
                          {p.nombre}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap py-2 px-3 text-stone-600">
                        {p.cantidadPedidos}
                      </td>
                      <td className="whitespace-nowrap py-2 px-3 text-stone-600">
                        {p.promedioIntervaloDias} días
                      </td>
                      <td className="whitespace-nowrap py-2 px-3 text-stone-600">
                        {resumenFormatos(p.cantidadPromedioPorFormato)}
                      </td>
                      <td className="whitespace-nowrap py-2 px-3 text-stone-600">
                        {formatFecha(p.proximaFechaEstimada)}
                      </td>
                      <td className={`whitespace-nowrap py-2 px-3 font-medium ${tendencia.clase}`}>
                        {tendencia.texto}
                      </td>
                      <td className="whitespace-nowrap py-2 pl-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${estado.clase}`}
                        >
                          {estado.texto}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
