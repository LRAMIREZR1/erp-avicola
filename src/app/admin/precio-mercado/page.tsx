import { createClient } from "@/lib/supabase/server";
import { formatCLP, formatFecha, hoyChile } from "@/lib/format";
import { requireRol } from "@/lib/roles";
import {
  registrarPrecioMercado,
  registrarReferenciaOdepa,
} from "@/app/admin/precio-mercado/actions";
import StatCard from "@/components/StatCard";
import EliminarPrecioMercadoButton from "@/components/EliminarPrecioMercadoButton";
import BotonRegistrarPrecioMercado from "@/components/BotonRegistrarPrecioMercado";
import {
  NOMBRES_CATEGORIA,
  NOMBRES_REGION_ODEPA,
  NOMBRES_UNIDAD_PRECIO,
  NOMBRES_ZONA,
  type Categoria,
  type Formato,
  type RegionOdepa,
  type UnidadPrecioMercado,
  type ZonaPrecioMercado,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

interface PrecioMercado {
  id: string;
  fecha: string;
  zona: ZonaPrecioMercado;
  categoria: Categoria | null;
  unidad: UnidadPrecioMercado;
  precio: number;
  fuente: string | null;
  nota: string | null;
  vendedores: { nombre: string } | null;
}

interface ReferenciaOdepa {
  id: string;
  semana_fecha: string;
  region: RegionOdepa;
  precio: number;
  fuente_url: string | null;
}

interface SugerenciaPrecio {
  id: string;
  semana_fecha: string;
  precio_actual: number;
  precio_sugerido: number;
  detalle: {
    metodo?: string;
    referencia_fuente?: string;
    referencia_valor?: number;
  } | null;
  productos: { nombre: string; formato: Formato; categoria: Categoria } | null;
}

// Orden de calidad para mostrar siempre igual: Super Extra, Extra, Primera,
// Segunda, Tercera.
const ORDEN_CATEGORIA: Record<Categoria, number> = {
  super_extra: 0,
  extra: 1,
  primera: 2,
  segunda: 3,
  tercera: 4,
};

function ordenarPorCategoria(lista: SugerenciaPrecio[]) {
  return [...lista].sort((a, b) => {
    const oa = a.productos ? ORDEN_CATEGORIA[a.productos.categoria] ?? 99 : 99;
    const ob = b.productos ? ORDEN_CATEGORIA[b.productos.categoria] ?? 99 : 99;
    return oa - ob;
  });
}

function haceDiasFecha(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

// Texto "$X por kilo" / "$X por bandeja de 30", etc.
function formatPrecio(precio: number, unidad: UnidadPrecioMercado) {
  return `${formatCLP(precio)} ${NOMBRES_UNIDAD_PRECIO[unidad]}`;
}

// Página informativa + de carga: no existe una fuente pública con precios
// mayoristas diarios entre avícolas en Chile, así que esto es un registro
// propio de lo que se escucha en el mercado día a día — más la referencia
// oficial (semanal, al consumidor) de ODEPA para Maule y la Región
// Metropolitana, de fondo.
export default async function PrecioMercadoPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const rol = await requireRol(["administrador"]);
  const { ok } = await searchParams;
  const supabase = await createClient();
  const hoy = hoyChile();

  const [{ data: precios }, { data: referencias }, { data: sugerenciasData }] = await Promise.all([
    supabase
      .from("precios_mercado")
      .select("id, fecha, zona, categoria, unidad, precio, fuente, nota, vendedores(nombre)")
      .gte("fecha", haceDiasFecha(29))
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("precios_referencia_odepa")
      .select("id, semana_fecha, region, precio, fuente_url")
      .order("semana_fecha", { ascending: false })
      .limit(12),
    // Trae varias semanas y se queda solo con la más reciente más abajo —
    // así, si una semana faltó algún producto, no se mezcla con la anterior.
    supabase
      .from("sugerencias_precio")
      .select("id, semana_fecha, precio_actual, precio_sugerido, detalle, productos(nombre, formato, categoria)")
      .order("semana_fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const lista = (precios ?? []) as unknown as PrecioMercado[];
  const listaOdepa = (referencias ?? []) as ReferenciaOdepa[];
  const todasSugerencias = (sugerenciasData ?? []) as unknown as SugerenciaPrecio[];
  const semanaSugerenciaMasReciente = todasSugerencias[0]?.semana_fecha;
  const sugerencias = todasSugerencias.filter(
    (s) => s.semana_fecha === semanaSugerenciaMasReciente
  );
  // Separadas en dos bloques — Bandejas (venta al detalle) y Cajas (venta
  // grande, B2B) — en vez de una sola lista mezclada. Dentro de cada bloque,
  // siempre en el mismo orden de calidad: Super Extra, Extra, Primera,
  // Segunda, Tercera.
  const sugerenciasBandejas = ordenarPorCategoria(
    sugerencias.filter((s) => s.productos?.formato === "bandeja_30")
  );
  const sugerenciasCajas = ordenarPorCategoria(
    sugerencias.filter((s) => s.productos?.formato !== "bandeja_30")
  );

  // Último precio registrado por zona (la lista ya viene ordenada del más
  // reciente al más antiguo).
  const ultimoMaule = lista.find((p) => p.zona === "maule");
  const ultimoSantiago = lista.find((p) => p.zona === "santiago");
  const ultimaOdepaRM = listaOdepa.find((r) => r.region === "metropolitana");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Precio de mercado del huevo</h1>
        <p className="text-sm text-stone-500">
          Registro propio de precios escuchados en Maule y Santiago, día a día
        </p>
      </div>

      {ok === "1" && (
        <div className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Precio registrado.
        </div>
      )}
      {ok === "2" && (
        <div className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Referencia ODEPA guardada.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Último precio — Maule"
          value={ultimoMaule ? formatPrecio(ultimoMaule.precio, ultimoMaule.unidad) : "—"}
          hint={
            ultimoMaule
              ? `${formatFecha(ultimoMaule.fecha)}${ultimoMaule.fuente ? ` · ${ultimoMaule.fuente}` : ""}`
              : "Sin registros en los últimos 30 días"
          }
        />
        <StatCard
          label="Último precio — Santiago"
          value={ultimoSantiago ? formatPrecio(ultimoSantiago.precio, ultimoSantiago.unidad) : "—"}
          hint={
            ultimoSantiago
              ? `${formatFecha(ultimoSantiago.fecha)}${ultimoSantiago.fuente ? ` · ${ultimoSantiago.fuente}` : ""}`
              : "Sin registros en los últimos 30 días"
          }
        />
        <StatCard
          label="Referencia ODEPA — RM"
          value={ultimaOdepaRM ? formatCLP(ultimaOdepaRM.precio) : "—"}
          hint={
            ultimaOdepaRM
              ? `Semana del ${formatFecha(ultimaOdepaRM.semana_fecha)} · precio al consumidor`
              : "Sin referencia cargada aún"
          }
        />
      </div>

      {sugerencias.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-700">Sugerencia semanal de precios</h2>
          <p className="mb-3 text-xs text-stone-400">
            Calculada automáticamente cada semana — semana del{" "}
            {formatFecha(semanaSugerenciaMasReciente!)}. &quot;Referencia&quot; es el precio de la
            competencia que efectivamente se usó para calcular el sugerido de cada producto —
            Huevos Santa Marta y/o Agricovial (mismo formato Caja 180, huevo color; si están los
            dos, es el promedio), Yemita (mayorista, con 19% de IVA agregado) o Cintazul/Jumbo
            (retail estimado) — ya en la misma base que nuestro precio (con IVA incluido). Es
            solo una referencia: nada se cambia solo, tú decides si ajustar el precio desde
            &quot;Productos y stock&quot;.
          </p>
          <TablaSugerencias titulo="Bandejas (30 unidades)" lista={sugerenciasBandejas} />
          <TablaSugerencias titulo="Cajas" lista={sugerenciasCajas} />
        </div>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-700">Registrar un precio</h2>
        <form action={registrarPrecioMercado} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="fecha" className="mb-1 block text-sm font-medium text-stone-800">
                Fecha
              </label>
              <input
                id="fecha"
                type="date"
                name="fecha"
                defaultValue={hoy}
                max={hoy}
                required
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="zona" className="mb-1 block text-sm font-medium text-stone-800">
                Zona
              </label>
              <select
                id="zona"
                name="zona"
                required
                defaultValue=""
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              >
                <option value="" disabled>
                  Selecciona una zona
                </option>
                {Object.entries(NOMBRES_ZONA).map(([valor, nombre]) => (
                  <option key={valor} value={valor}>
                    {nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="categoria" className="mb-1 block text-sm font-medium text-stone-800">
                Categoría (opcional)
              </label>
              <select
                id="categoria"
                name="categoria"
                defaultValue=""
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              >
                <option value="">Sin especificar</option>
                {Object.entries(NOMBRES_CATEGORIA).map(([valor, nombre]) => (
                  <option key={valor} value={valor}>
                    {nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="precio" className="mb-1 block text-sm font-medium text-stone-800">
                Precio (CLP)
              </label>
              <input
                id="precio"
                type="number"
                name="precio"
                min={1}
                step="1"
                placeholder="Ej: 3200"
                required
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="unidad" className="mb-1 block text-sm font-medium text-stone-800">
                Unidad
              </label>
              <select
                id="unidad"
                name="unidad"
                defaultValue="kilo"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              >
                {Object.entries(NOMBRES_UNIDAD_PRECIO).map(([valor, nombre]) => (
                  <option key={valor} value={valor}>
                    {nombre.replace(/^por /, "")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fuente" className="mb-1 block text-sm font-medium text-stone-800">
                Fuente (opcional)
              </label>
              <input
                id="fuente"
                type="text"
                name="fuente"
                placeholder="Ej: Avícola X, distribuidor Y…"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="nota" className="mb-1 block text-sm font-medium text-stone-800">
              Nota (opcional)
            </label>
            <input
              id="nota"
              type="text"
              name="nota"
              placeholder="Cualquier detalle adicional…"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>
          <BotonRegistrarPrecioMercado />
        </form>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-stone-700">Últimos 30 días</p>
        {lista.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-400">
            Aún no hay precios registrados
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-stone-500">
                  <th className="whitespace-nowrap py-2 pr-3 font-medium">Día</th>
                  <th className="whitespace-nowrap py-2 px-3 font-medium">Zona</th>
                  <th className="whitespace-nowrap py-2 px-3 font-medium">Categoría</th>
                  <th className="whitespace-nowrap py-2 px-3 text-right font-medium">Precio</th>
                  <th className="whitespace-nowrap py-2 px-3 font-medium">Fuente</th>
                  <th className="whitespace-nowrap py-2 pl-3 font-medium">Nota</th>
                  {rol === "administrador" && <th className="whitespace-nowrap py-2 pl-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lista.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap py-2 pr-3 text-stone-700">
                      {formatFecha(p.fecha)}
                      {p.fecha === hoy && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Hoy
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2 px-3 text-stone-600">
                      {NOMBRES_ZONA[p.zona]}
                    </td>
                    <td className="whitespace-nowrap py-2 px-3 text-stone-600">
                      {p.categoria ? NOMBRES_CATEGORIA[p.categoria] : "—"}
                    </td>
                    <td className="whitespace-nowrap py-2 px-3 text-right font-semibold text-stone-800">
                      {formatPrecio(p.precio, p.unidad)}
                    </td>
                    <td className="whitespace-nowrap py-2 px-3 text-stone-600">
                      {p.fuente ?? "—"}
                    </td>
                    <td className="max-w-[220px] whitespace-normal py-2 pl-3 text-stone-500">
                      {p.nota ?? "—"}
                    </td>
                    {rol === "administrador" && (
                      <td className="whitespace-nowrap py-2 pl-3 text-right">
                        <EliminarPrecioMercadoButton id={p.id} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rol === "administrador" && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-700">Referencia semanal ODEPA</h2>
          <p className="mb-3 text-xs text-stone-400">
            Precio oficial AL CONSUMIDOR (supermercados/ferias) que publica ODEPA todos los
            viernes — no es lo que se transa entre avícolas, pero sirve como referencia pública
            para comparar. Se ingresa a mano cada semana.
          </p>
          <form
            action={registrarReferenciaOdepa}
            className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap"
          >
            <div>
              <label
                htmlFor="semana_fecha"
                className="mb-1 block text-sm font-medium text-stone-800"
              >
                Semana del boletín
              </label>
              <input
                id="semana_fecha"
                type="date"
                name="semana_fecha"
                defaultValue={hoy}
                max={hoy}
                required
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="region" className="mb-1 block text-sm font-medium text-stone-800">
                Región
              </label>
              <select
                id="region"
                name="region"
                required
                defaultValue=""
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              >
                <option value="" disabled>
                  Selecciona una región
                </option>
                {Object.entries(NOMBRES_REGION_ODEPA).map(([valor, nombre]) => (
                  <option key={valor} value={valor}>
                    {nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="precio_odepa"
                className="mb-1 block text-sm font-medium text-stone-800"
              >
                Precio (CLP)
              </label>
              <input
                id="precio_odepa"
                type="number"
                name="precio_odepa"
                min={1}
                step="1"
                placeholder="Ej: 3450"
                required
                className="w-32 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              />
            </div>
            <div className="sm:flex-1 sm:min-w-[200px]">
              <label
                htmlFor="fuente_url"
                className="mb-1 block text-sm font-medium text-stone-800"
              >
                Link del boletín (opcional)
              </label>
              <input
                id="fuente_url"
                type="url"
                name="fuente_url"
                placeholder="https://www.odepa.gob.cl/…"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              Guardar
            </button>
          </form>

          {listaOdepa.length > 0 && (
            <div className="-mx-4 mt-4 overflow-x-auto px-4">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-stone-500">
                    <th className="whitespace-nowrap py-2 pr-3 font-medium">Semana</th>
                    <th className="whitespace-nowrap py-2 px-3 font-medium">Región</th>
                    <th className="whitespace-nowrap py-2 pl-3 text-right font-medium">Precio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {listaOdepa.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap py-2 pr-3 text-stone-700">
                        {formatFecha(r.semana_fecha)}
                      </td>
                      <td className="whitespace-nowrap py-2 px-3 text-stone-600">
                        {NOMBRES_REGION_ODEPA[r.region]}
                      </td>
                      <td className="whitespace-nowrap py-2 pl-3 text-right font-semibold text-stone-800">
                        {formatCLP(r.precio)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Tabla de sugerencias reutilizable — se usa dos veces (Bandejas y Cajas)
// para que el reporte quede separado por tipo de venta en vez de una sola
// lista mezclada.
function TablaSugerencias({ titulo, lista }: { titulo: string; lista: SugerenciaPrecio[] }) {
  if (lista.length === 0) return null;

  return (
    <div className="mt-4 first:mt-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
        {titulo}
      </p>
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-stone-500">
              <th className="whitespace-nowrap py-2 pr-3 font-medium">Producto</th>
              <th className="whitespace-nowrap py-2 px-3 text-right font-medium">
                Precio actual
              </th>
              <th className="whitespace-nowrap py-2 px-3 text-right font-medium">Referencia</th>
              <th className="whitespace-nowrap py-2 px-3 text-right font-medium">Sugerido</th>
              <th className="whitespace-nowrap py-2 pl-3 text-right font-medium">Diferencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {lista.map((s) => {
              const diferencia = s.precio_sugerido - s.precio_actual;
              const referenciaValor = s.detalle?.referencia_valor;
              const referenciaFuente = s.detalle?.referencia_fuente;
              return (
                <tr key={s.id}>
                  <td className="whitespace-nowrap py-2 pr-3 text-stone-700">
                    {s.productos?.nombre ?? "—"}
                  </td>
                  <td className="whitespace-nowrap py-2 px-3 text-right text-stone-600">
                    {formatCLP(s.precio_actual)}
                  </td>
                  <td className="whitespace-nowrap py-2 px-3 text-right text-stone-500">
                    {referenciaValor != null ? formatCLP(referenciaValor) : "—"}
                    {referenciaFuente && (
                      <div className="text-[11px] leading-tight text-stone-400">
                        {referenciaFuente}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2 px-3 text-right font-semibold text-stone-800">
                    {formatCLP(s.precio_sugerido)}
                  </td>
                  <td
                    className={`whitespace-nowrap py-2 pl-3 text-right font-medium ${
                      diferencia > 0
                        ? "text-green-700"
                        : diferencia < 0
                          ? "text-red-600"
                          : "text-stone-400"
                    }`}
                  >
                    {diferencia > 0 ? "+" : ""}
                    {formatCLP(diferencia)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
