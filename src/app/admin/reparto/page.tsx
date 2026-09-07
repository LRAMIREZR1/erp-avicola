import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCLP, formatFecha } from "@/lib/format";
import EstadoSelector from "@/components/EstadoSelector";
import ImprimirButton from "@/components/ImprimirButton";
import MarcarEntregadoButton from "@/components/MarcarEntregadoButton";
import { requireRol } from "@/lib/roles";
import {
  NOMBRES_CATEGORIA,
  NOMBRES_FORMATO,
  type Categoria,
  type Formato,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

interface ItemConsolidado {
  producto_id: string;
  nombre: string;
  categoria: string;
  formato: string;
  cantidad: number;
}

interface PedidoReparto {
  id: string;
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

function esCaja(formato: string) {
  return formato !== "bandeja_30";
}

function TablaConsolidado({ items }: { items: ItemConsolidado[] }) {
  if (items.length === 0) {
    return <p className="py-4 text-center text-sm text-stone-400">Nada de esto en esta carga</p>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 print:border-stone-500">
      <table className="w-full text-left text-sm">
        <thead className="bg-stone-200 text-xs font-semibold uppercase tracking-wide text-stone-600">
          <tr>
            <th className="w-8 px-3 py-2"></th>
            <th className="px-4 py-2">Producto</th>
            <th className="px-4 py-2">Categoría</th>
            <th className="px-4 py-2">Formato</th>
            <th className="px-4 py-2 text-right">Cantidad a cargar</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 print:divide-stone-400">
          {items.map((item) => (
            <tr key={item.producto_id}>
              <td className="px-3 py-2 text-center text-stone-400">☐</td>
              <td className="px-4 py-2 font-medium text-stone-800">{item.nombre}</td>
              <td className="px-4 py-2 text-stone-600">
                {NOMBRES_CATEGORIA[item.categoria as Categoria]}
              </td>
              <td className="px-4 py-2 text-stone-600">
                {NOMBRES_FORMATO[item.formato as Formato]}
              </td>
              <td className="px-4 py-2 text-right font-semibold text-stone-800">
                {item.cantidad}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function RepartoPage() {
  const rol = await requireRol(["administrador", "vendedor", "encargado_bodega", "repartidor"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("pedidos")
    .select(
      "id, fecha_entrega, notas, total, pagado, clientes(nombre, telefono, direccion, zona_entrega), pedido_items(cantidad, productos(id, nombre, categoria, formato))"
    )
    .eq("estado", "en_preparacion")
    .order("fecha_entrega", { ascending: true });

  const lista = (data ?? []) as unknown as PedidoReparto[];

  // Orden de ruta: agrupado por zona de entrega (los sin zona quedan al final),
  // y dentro de cada zona por nombre de cliente. Sirve tanto para la tabla
  // resumen como para el detalle por cliente, así los números coinciden.
  const listaRuta = [...lista].sort((a, b) => {
    const zonaA = a.clientes?.zona_entrega ?? "";
    const zonaB = b.clientes?.zona_entrega ?? "";
    if (zonaA !== zonaB) {
      if (!zonaA) return 1;
      if (!zonaB) return -1;
      return zonaA.localeCompare(zonaB);
    }
    return (a.clientes?.nombre ?? "").localeCompare(b.clientes?.nombre ?? "");
  });

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
  const totalACobrar = listaRuta
    .filter((p) => !p.pagado)
    .reduce((acc, p) => acc + Number(p.total), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-stone-800">Carga para reparto</h1>
          <p className="text-sm text-stone-500">
            Consolidado de pedidos en preparación, listos para cargar y entregar
          </p>
        </div>
        <ImprimirButton />
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
              <div className="break-inside-avoid overflow-hidden rounded-2xl border border-stone-200 print:border-stone-500 bg-white">
                <div className="p-4 pb-3">
                  <p className="text-sm font-medium text-stone-700">
                    Ruta del día ({listaRuta.length} parada{listaRuta.length === 1 ? "" : "s"})
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
                    {listaRuta.map((p, i) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2 font-semibold text-stone-800">{i + 1}</td>
                        <td className="px-4 py-2 text-stone-700">
                          {p.clientes?.nombre ?? "Cliente"}
                        </td>
                        <td className="px-4 py-2 text-stone-600">
                          {p.clientes?.zona_entrega ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-stone-600">
                          {p.clientes?.direccion ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {p.pagado ? (
                            <span className="text-stone-400">Pagado</span>
                          ) : (
                            <span className="font-semibold text-amber-700">
                              {formatCLP(Number(p.total))}
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
              {listaRuta.map((p, index) => {
                const items = p.pedido_items ?? [];
                const itemsCajas = items.filter(
                  (i) => i.productos && esCaja(i.productos.formato)
                );
                const itemsBandejas = items.filter(
                  (i) => i.productos && !esCaja(i.productos.formato)
                );
                const zonaAnterior =
                  index > 0 ? listaRuta[index - 1].clientes?.zona_entrega ?? "" : null;
                const zonaActual = p.clientes?.zona_entrega ?? "";
                const mostrarEncabezadoZona = index === 0 || zonaActual !== zonaAnterior;

                return (
                  <div key={p.id}>
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
                            {p.clientes?.nombre ?? "Cliente"}
                          </p>
                          <p className="text-sm text-stone-500">
                            {p.clientes?.direccion ?? "Sin dirección"}
                            {p.clientes?.zona_entrega ? ` · ${p.clientes.zona_entrega}` : ""}
                          </p>
                          {p.clientes?.telefono && (
                            <p className="text-sm text-stone-500">{p.clientes.telefono}</p>
                          )}
                          {p.fecha_entrega && (
                            <p className="text-xs text-stone-400">
                              Entrega prevista: {formatFecha(p.fecha_entrega)}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-right">
                            <p className="text-base font-semibold text-stone-800">
                              {formatCLP(Number(p.total))}
                            </p>
                            {p.pagado ? (
                              <p className="text-xs font-medium text-stone-400">Ya pagado</p>
                            ) : (
                              <p className="text-xs font-semibold text-amber-700">
                                Por cobrar (efectivo / transferencia)
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 print:hidden">
                            {rol === "repartidor" ? (
                              <MarcarEntregadoButton pedidoId={p.id} />
                            ) : rol === "administrador" ? (
                              <>
                                <EstadoSelector pedidoId={p.id} estado="en_preparacion" />
                                <Link
                                  href={`/admin/pedidos/${p.id}`}
                                  className="text-sm text-amber-700 hover:underline"
                                >
                                  Ver
                                </Link>
                              </>
                            ) : (
                              <Link
                                href={`/admin/pedidos/${p.id}`}
                                className="text-sm text-amber-700 hover:underline"
                              >
                                Ver
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 border-t border-stone-100 print:border-stone-400 pt-3 sm:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
                            Cajas
                          </p>
                          {itemsCajas.length === 0 ? (
                            <p className="text-sm text-stone-400">—</p>
                          ) : (
                            <ul className="space-y-1 text-sm text-stone-700">
                              {itemsCajas.map((item, i) => (
                                <li key={i}>
                                  ☐ {item.productos?.nombre ?? "Producto"} × {item.cantidad}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
                            Bandejas
                          </p>
                          {itemsBandejas.length === 0 ? (
                            <p className="text-sm text-stone-400">—</p>
                          ) : (
                            <ul className="space-y-1 text-sm text-stone-700">
                              {itemsBandejas.map((item, i) => (
                                <li key={i}>
                                  ☐ {item.productos?.nombre ?? "Producto"} × {item.cantidad}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      {p.notas && <p className="mt-2 text-xs text-stone-500">Nota: {p.notas}</p>}
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
