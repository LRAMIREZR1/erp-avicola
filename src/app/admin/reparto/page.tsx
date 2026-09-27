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
    latitud: number | null;
    longitud: number | null;
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

// Link de Google Maps para ir directo a la dirección del cliente. Prioriza
// el punto exacto cargado en el mapa (más confiable); si el cliente todavía
// no tiene uno, cae de respaldo a buscar por el texto de la dirección.
function enlaceMapa(cliente: PedidoReparto["clientes"]): string | null {
  if (!cliente) return null;
  if (cliente.latitud != null && cliente.longitud != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${cliente.latitud},${cliente.longitud}`;
  }
  if (cliente.direccion) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cliente.direccion)}`;
  }
  return null;
}

export default async function RepartoPage() {
  const rol = await requireRol(["administrador", "vendedor", "repartidor"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("pedidos")
    .select(
      "id, cliente_id, fecha_entrega, notas, total, pagado, clientes(nombre, telefono, direccion, latitud, longitud, zona_entrega), pedido_items(cantidad, productos(id, nombre, categoria, formato))"
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
          No hay pedidos
