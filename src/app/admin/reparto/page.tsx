import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCLP, formatFecha } from "@/lib/format";
import EstadoSelector from "@/components/EstadoSelector";
import ImprimirButton from "@/components/ImprimirButton";
import MarcarEntregadoButton from "@/components/MarcarEntregadoButton";
import TablaConsolidado, { esCaja, type ItemConsolidado } from "@/components/TablaConsolidado";
import { requireRol } from "@/lib/roles";

export const dynamic = "force-dynamic";

interface PedidoReparto {
  id: string;
  cliente_id: string | null;
  fecha_entrega: string | null;
  notas: string | null;
  total: number;
  pagado: boolean;
  clientes: {
    nombre: string;
    telefono: string | null;
    direccion: string | null;
    zona_entrega: string | null;
  } | null;
  pedido_items: {
    cantidad: number;
    productos: {
      id: string;
      nombre: string;
      categoria: string;
      formato: string;
    } | null;
  }[];
}

// Una parada de reparto por cliente: si un mismo cliente tiene más de un
// pedido en preparación (ej. se le agregó un pedido extra el mismo día), se
// entregan juntos en una sola parada, con la carga y el cobro sumados.
interface GrupoReparto {
  clienteId: string;
  cliente: PedidoReparto["clientes"];
  pedidos: PedidoReparto[];
  itemsCajas: ItemConsolidado[];
  itemsBandejas: ItemConsolidado[];
  total: number;
  totalPendiente: number;
}

type GrupoAcumulado = {
  clienteId: string;
  cliente: PedidoReparto["clientes"];
  pedidos: PedidoReparto[];
  itemsMap: Map<string, ItemConsolidado>;
  total: number;
  totalPendiente: number;
};

function agruparPorCliente(lista: PedidoReparto[]): GrupoReparto[] {
  const grupos = new Map<string, GrupoAcumulado>();

  for (const p of lista) {
    // Sin cliente_id (no debería pasar en pedidos normales) cada pedido
    // queda en su propia parada, para no mezclar clientes por error.
    const clienteId = p.cliente_id ?? p.id;
    const grupo = grupos.get(clienteId) ?? {
      clienteId,
      cliente: p.clientes,
      pedidos: [],
      itemsMap: new Map<string, ItemConsolidado>(),
      total: 0,
      totalPendiente: 0,
    };
    grupo.pedidos.push(p);
    grupo.total += Number(p.total);
    if (!p.pagado) grupo.totalPendiente += Number(p.total);
    for (const item of p.pedido_items ?? []) {
      const producto = item.productos;
      if (!producto) continue;
      const actual = grupo.itemsMap.get(producto.id) ?? {
        producto_id: producto.id,
        nombre: producto.nombre,
        categoria: producto.categoria,
        formato: producto.formato,
        cantidad: 0,
      };
      actual.cantidad += item.cantidad;
      grupo.itemsMap.set(producto.id, actual);
    }
    grupos.set(clienteId, grupo);
  }

  const lista_final: GrupoReparto[] = [...grupos.values()].map((g) => {
    const items = [...g.itemsMap.values()];
    return {
      clienteId: g.clienteId,
      cliente: g.cliente,
      pedidos: g.pedidos,
      itemsCajas: items.filter((i) => esCaja(i.formato)),
      itemsBandejas: items.filter((i) => !esCaja(i.formato)),
      total: g.total,
      totalPendiente: g.totalPendiente,
    };
  });

  // Mismo orden de ruta que antes: por zona de entrega (sin zona al final)
  // y dentro de cada zona por nombre de cliente.
  return lista_final.sort((a, b) => {
    const zonaA = a.cliente?.zona_entrega ?? "";
    const zonaB = b.cliente?.zona_entrega ?? "";
    if (zonaA !== zonaB) {
      if (!zonaA) return 1;
      if (!zonaB) return -1;
      return zonaA.localeCompare(zonaB);
    }
    return (a.cliente?.nombre ?? "").localeCompare(b.cliente?.nombre ?? "");
  });
}

export default async function RepartoPage() {
  const rol = await requireRol(["administrador", "vendedor", "encargado_bodega", "repartidor"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("pedidos")
    .select(
      "id, cliente_id, fecha_entrega, notas, total, pagado, clientes(nombre, telefono, direccion, zona_entrega), pedido_items(cantidad, productos(id, nombre, categoria, formato))"
    )
    .eq("estado", "en_preparacion")
    .order("fecha_entrega", { ascending: true });

  const lista = (data ?? []) as unknown as PedidoReparto[];
  const gruposRuta = agruparPorCliente(lista);

  const consolidadoMap = new Map<string, ItemConsolidado>();
  for (const p of lista) {
    for (const item of p.pedido_items ?? []) {
      const producto = item.productos;
      if (!producto) continue;
      const actual = consolidadoMap.get(producto.id) ?? {
        producto_id: producto.id,
        nombre: producto.nombre,
        categoria: producto.categoria,
        formato: producto.formato,
        cantidad: 0,
      };
      actual.cantidad += item.cantidad;
      consolidadoMap.set(producto.id, actual);
    }
  }
  const consolidado = [...consolidadoMap.values()].sort((a, b) => {
    if (a.categoria !== b.categoria) return a.categoria.localeCompare(b.categoria);
    return a.formato.localeCompare(b.formato);
  });
  const consolidadoCajas = consolidado.filter((i) => esCaja(i.formato));
  const consolidadoBandejas = consolidado.filter((i) => !esCaja(i.formato));
  const totalCajas = consolidadoCajas.reduce((acc, i) => acc + i.cantidad, 0);
  const totalBandejas = consolidadoBandejas.reduce((acc, i) => acc + i.cantidad, 0);
  const totalACobrar = gruposRuta.reduce((acc, g) => acc + g.totalPendiente, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-stone-800">Carga para reparto</h1>
          <p className="text-sm text-stone-500">
            Consolidado de pedidos en preparación, listos para cargar y entregar
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/reparto/historial"
            className="text-sm font-medium text-amber-700 hover:underline"
          >
            Ver historial de repartos
          </Link>
          <ImprimirButton />
        </div>
      </div>

      <div className="hidden print:block">
        <h1 className="text-lg font-semibold text-stone-800">Carga para reparto</h1>
        <p className="text-sm text-stone-500">
          {new Intl.DateTimeFormat("es-CL", {
            dateStyle: "full",
            timeZone: "America/Santiago",
          }).format(new Date())}
        </p>
      </div>

      {lista.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 print:border-stone-500 bg-white p-8 text-center text-stone-400">
          No hay pedidos en preparación en este momento
        </div>
      ) : (
        <>
          <div className="break-inside-avoid rounded-2xl border border-stone-200 print:border-stone-500 bg-white p-4">
            <p className="mb-3 text-sm font-medium text-stone-700">
              Resumen de carga ({lista.length} pedido{lista.length === 1 ? "" : "s"})
            </p>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-stone-700">
                Cajas (120 / 180 un.) — {totalCajas} en total
              </h2>
              <TablaConsolidado items={consolidadoCajas} />
            </div>

            <div className="mt-5 space-y-3">
              <h2 className="text-sm font-semibold text-stone-700">
                Bandejas (30 un.) — {totalBandejas} en total
              </h2>
              <TablaConsolidado items={consolidadoBandejas} />
            </div>
          </div>

          {rol !== "encargado_bodega" && (
            <div className="space-y-4">
              <div className="break-inside-avoid overflow-x-auto rounded-2xl border border-stone-200 print:overflow-visible print:border-stone-500 bg-white">
                <div className="p-4 pb-3">
                  <p className="text-sm font-medium text-stone-700">
                    Ruta del día ({gruposRuta.length} parada{gruposRuta.length === 1 ? "" : "s"})
                  </p>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="bg-stone-200 text-xs font-semibold uppercase tracking-wide text-stone-600">
                    <tr>
                      <th className="w-10 px-4 py-2">N°</th>
                      <th className="px-4 py-2">Cliente</th>
                      <th className="px-4 py-2">Zona</th>
                      <th className="px-4 py-2">Dirección</th>
                      <th className="px-4 py-2 text-right">Cobrar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 print:divide-stone-400">
                    {gruposRuta.map((g, i) => (
                      <tr key={g.clienteId}>
                        <td className="px-4 py-2 font-semibold text-stone-800">{i + 1}</td>
                        <td className="px-4 py-2 text-stone-700">
                          {g.cliente?.nombre ?? "Cliente"}
                          {g.pedidos.length > 1 && (
                            <span className="ml-1 text-xs font-normal text-stone-400">
                              ({g.pedidos.length} pedidos)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-stone-600">
                          {g.cliente?.zona_entrega ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-stone-600">
                          {g.cliente?.direccion ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {g.totalPendiente <= 0 ? (
                            <span className="font-semibold text-green-700">PAGADO</span>
                          ) : (
                            <span className="font-semibold text-amber-700">
                              {formatCLP(g.totalPendiente)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-stone-200 print:border-stone-500 bg-stone-50">
                      <td colSpan={4} className="px-4 py-2 text-right font-medium text-stone-600">
                        Total a cobrar en la ruta
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-stone-800">
                        {formatCLP(totalACobrar)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className="text-sm font-medium text-stone-700">
                Detalle por cliente (para armar cada pedido)
              </p>
              {gruposRuta.map((g, index) => {
                const zonaAnterior =
                  index > 0 ? gruposRuta[index - 1].cliente?.zona_entrega ?? "" : null;
                const zonaActual = g.cliente?.zona_entrega ?? "";
                const mostrarEncabezadoZona = index === 0 || zonaActual !== zonaAnterior;
                const pedidoIds = g.pedidos.map((p) => p.id);
                const notas = g.pedidos.filter((p) => p.notas);

                return (
                  <div key={g.clienteId}>
                    {mostrarEncabezadoZona && (
                      <p
                        className={
                          index === 0
                            ? "mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700"
                            : "mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-amber-700"
                        }
                      >
                        {zonaActual || "Sin zona asignada"}
                      </p>
                    )}
                    <div className="break-inside-avoid rounded-2xl border border-stone-200 print:border-stone-500 bg-white p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="flex items-center gap-2 font-medium text-stone-800">
                            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-800 text-xs font-semibold text-white">
                              {index + 1}
                            </span>
                            {g.cliente?.nombre ?? "Cliente"}
                            {g.pedidos.length > 1 && (
                              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                                {g.pedidos.length} pedidos
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-stone-500">
                            {g.cliente?.direccion ?? "Sin dirección"}
                            {g.cliente?.zona_entrega ? ` · ${g.cliente.zona_entrega}` : ""}
                          </p>
                          {g.cliente?.telefono && (
                            <p className="text-sm text-stone-500">{g.cliente.telefono}</p>
                          )}
                          {g.pedidos.some((p) => p.fecha_entrega) && (
                            <p className="text-xs text-stone-400">
                              Entrega prevista:{" "}
                              {[...new Set(g.pedidos.map((p) => p.fecha_entrega).filter(Boolean))]
                                .map((f) => formatFecha(f as string))
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-right">
                            {g.totalPendiente <= 0 ? (
                              <p className="text-base font-bold text-green-700">PAGADO</p>
                            ) : (
                              <>
                                <p className="text-base font-semibold text-stone-800">
                                  {formatCLP(g.totalPendiente)}
                                </p>
                                <p className="text-xs font-semibold text-amber-700">
                                  Por cobrar (efectivo / transferencia)
                                </p>
                                {g.totalPendiente < g.total && (
                                  <p className="text-xs text-stone-400">
                                    Total pedidos: {formatCLP(g.total)}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 print:hidden">
                            {rol === "repartidor" ? (
                              <MarcarEntregadoButton pedidoIds={pedidoIds} />
                            ) : rol === "administrador" ? (
                              <>
                                {g.pedidos.map((p, i) => (
                                  <div key={p.id} className="flex items-center gap-2">
                                    {g.pedidos.length > 1 && (
                                      <span className="text-xs text-stone-400">Pedido {i + 1}:</span>
                                    )}
                                    <EstadoSelector pedidoId={p.id} estado="en_preparacion" />
                                    <Link
                                      href={`/admin/pedidos/${p.id}`}
                                      className="text-sm text-amber-700 hover:underline"
                                    >
                                      Ver
                                    </Link>
                                  </div>
                                ))}
                              </>
                            ) : (
                              <div className="flex flex-col items-end gap-1">
                                {g.pedidos.map((p) => (
                                  <Link
                                    key={p.id}
                                    href={`/admin/pedidos/${p.id}`}
                                    className="text-sm text-amber-700 hover:underline"
                                  >
                                    Ver pedido
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 border-t border-stone-100 print:border-stone-400 pt-3 sm:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
                            Cajas
                          </p>
                          {g.itemsCajas.length === 0 ? (
                            <p className="text-sm text-stone-400">—</p>
                          ) : (
                            <ul className="space-y-1 text-base font-semibold text-stone-800">
                              {g.itemsCajas.map((item) => (
                                <li key={item.producto_id}>
                                  ☐ {item.nombre} <span className="font-bold">× {item.cantidad}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
                            Bandejas
                          </p>
                          {g.itemsBandejas.length === 0 ? (
                            <p className="text-sm text-stone-400">—</p>
                          ) : (
                            <ul className="space-y-1 text-base font-semibold text-stone-800">
                              {g.itemsBandejas.map((item) => (
                                <li key={item.producto_id}>
                                  ☐ {item.nombre} <span className="font-bold">× {item.cantidad}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      {notas.length > 0 && (
                        <div className="mt-2 space-y-0.5">
                          {notas.map((p) => (
                            <p key={p.id} className="text-xs text-stone-500">
                              Nota: {p.notas}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
