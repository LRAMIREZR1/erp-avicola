import {
  NOMBRES_CATEGORIA,
  NOMBRES_FORMATO,
  type Categoria,
  type Formato,
} from "@/lib/supabase/types";

export interface ItemConsolidado {
  producto_id: string;
  nombre: string;
  categoria: string;
  formato: string;
  cantidad: number;
}

// Compartido entre "Carga para reparto" (lo que hay que cargar hoy) y el
// historial de repartos (lo que se entregó un día ya pasado) — misma tabla,
// solo cambia de dónde viene la lista de items.
export function esCaja(formato: string) {
  return formato !== "bandeja_30";
}

export default function TablaConsolidado({
  items,
  etiquetaCantidad = "Cantidad a cargar",
  marcarCasillero = true,
}: {
  items: ItemConsolidado[];
  etiquetaCantidad?: string;
  marcarCasillero?: boolean;
}) {
  if (items.length === 0) {
    return <p className="py-4 text-center text-sm text-stone-400">Nada de esto en esta carga</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 print:overflow-visible print:border-stone-500">
      <table className="w-full text-left text-sm">
        <thead className="bg-stone-200 text-xs font-semibold uppercase tracking-wide text-stone-600">
          <tr>
            {marcarCasillero && <th className="w-8 px-3 py-2"></th>}
            <th className="px-4 py-2">Producto</th>
            <th className="px-4 py-2">Categoría</th>
            <th className="px-4 py-2">Formato</th>
            <th className="px-4 py-2 text-right">{etiquetaCantidad}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 print:divide-stone-400">
          {items.map((item) => (
            <tr key={item.producto_id}>
              {marcarCasillero && (
                <td className="px-3 py-2 text-center text-stone-400">☐</td>
              )}
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
