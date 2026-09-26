import { createClient } from "@/lib/supabase/server";
import { formatCLP } from "@/lib/format";
import { requireRol } from "@/lib/roles";
import { NOMBRES_CATEGORIA, NOMBRES_FORMATO, type Categoria, type Formato } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// Descuento por volumen para venta de cajas, en el mismo espíritu del
// afiche de "Distribuidora La Suprema" que mandó Luis de referencia (ellos
// usan -1,9% en el tramo medio y -3,6% en el de 10+). Para cambiar el
// descuento, ajusta estos dos números — se aplica igual a todas las
// categorías, sobre el precio de lista que ya está cargado en "Productos y
// stock" (esta pantalla no tiene un precio propio: siempre calcula en vivo
// a partir de ese precio, así que si lo actualizas allá, se actualiza acá
// solo).
const DESCUENTO_TRAMO_6_A_9 = 0.019;
const DESCUENTO_TRAMO_10_O_MAS = 0.036;

// Orden de calidad, de mayor a menor — igual que en el resto del sistema.
const ORDEN_CATEGORIA: Record<Categoria, number> = {
  super_extra: 0,
  extra: 1,
  primera: 2,
  segunda: 3,
  tercera: 4,
};

// Los precios de lista son montos redondos (miles), pero un 1,9% o 3,6% de
// descuento da números feos ($37.278). Se redondea a la centena más
// cercana para que quede un precio fácil de decir por teléfono o WhatsApp.
function redondearCien(valor: number) {
  return Math.round(valor / 100) * 100;
}

interface ProductoCaja {
  id: string;
  nombre: string;
  categoria: Categoria;
  formato: Formato;
  precio: number;
}

export default async function PrecioMayoristaPage() {
  await requireRol(["administrador"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("productos")
    .select("id, nombre, categoria, formato, precio")
    .eq("activo", true)
    .in("formato", ["caja_120", "caja_180"])
    .order("precio", { ascending: false });

  const productos = ((data ?? []) as ProductoCaja[]).sort(
    (a, b) => (ORDEN_CATEGORIA[a.categoria] ?? 99) - (ORDEN_CATEGORIA[b.categoria] ?? 99)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Precio mayorista</h1>
        <p className="text-sm text-stone-500">
          Tabla de descuento por volumen para venta de cajas — pensada para cotizar rápido por
          teléfono o WhatsApp
        </p>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-xs text-stone-400">
          Tramo medio (6 a 9 cajas): -{(DESCUENTO_TRAMO_6_A_9 * 100).toFixed(1)}%. Tramo mayor (10
          o más cajas): -{(DESCUENTO_TRAMO_10_O_MAS * 100).toFixed(1)}%. Se calcula siempre sobre
          el precio de lista vigente en &quot;Productos y stock&quot; — si lo cambias allá, esta
          tabla se actualiza sola. Solo aplica a venta por cajas (no bandejas).
        </p>

        {productos.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-400">
            No hay productos por caja activos todavía
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-stone-500">
                  <th className="whitespace-nowrap py-2 pr-3 font-medium">Categoría</th>
                  <th className="whitespace-nowrap py-2 px-3 font-medium">Formato</th>
                  <th className="whitespace-nowrap py-2 px-3 text-right font-medium">
                    1 a 5 cajas
                  </th>
                  <th className="whitespace-nowrap py-2 px-3 text-right font-medium">
                    6 a 9 cajas
                  </th>
                  <th className="whitespace-nowrap py-2 pl-3 text-right font-medium">
                    10 o más cajas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {productos.map((p) => {
                  const precioBase = p.precio;
                  const precioTramo2 = redondearCien(precioBase * (1 - DESCUENTO_TRAMO_6_A_9));
                  const precioTramo3 = redondearCien(
                    precioBase * (1 - DESCUENTO_TRAMO_10_O_MAS)
                  );
                  return (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap py-2 pr-3 font-medium text-stone-800">
                        {NOMBRES_CATEGORIA[p.categoria]}
                      </td>
                      <td className="whitespace-nowrap py-2 px-3 text-stone-500">
                        {NOMBRES_FORMATO[p.formato]}
                      </td>
                      <td className="whitespace-nowrap py-2 px-3 text-right text-stone-700">
                        {formatCLP(precioBase)}
                      </td>
                      <td className="whitespace-nowrap py-2 px-3 text-right text-stone-700">
                        {formatCLP(precioTramo2)}
                      </td>
                      <td className="whitespace-nowrap py-2 pl-3 text-right font-semibold text-amber-800">
                        {formatCLP(precioTramo3)}
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
