import { Fragment } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { diaChileDe, formatFecha, formatFechaHora } from "@/lib/format";
import { requireRol } from "@/lib/roles";
import { NOMBRES_CATEGORIA, NOMBRES_FORMATO, type Categoria, type Formato } from "@/lib/supabase/types";
import EliminarMovimientoButton from "@/components/EliminarMovimientoButton";

function hace(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

const COLORES_TIPO: Record<string, string> = {
  entrada: "bg-green-100 text-green-700",
  salida: "bg-red-100 text-red-700",
  ajuste: "bg-amber-100 text-amber-700",
};

const NOMBRES_TIPO: Record<string, string> = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
};

function formatoCantidad(tipo: string, cantidad: number) {
  if (tipo === "salida") return `-${Math.abs(cantidad)}`;
  if (tipo === "entrada") return `+${Math.abs(cantidad)}`;
  return cantidad > 0 ? `+${cantidad}` : `${cantidad}`;
}

interface Movimiento {
  id: string;
  tipo: string;
  cantidad: number;
  motivo: string | null;
  created_at: string;
  pedido_id: string | null;
  productos: { nombre: string; categoria: string; formato: string } | null;
  vendedores: { nombre: string } | null;
}

export default async function MovimientosStockPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const rol = await requireRol(["administrador", "encargado_bodega"]);
  const params = await searchParams;
  const desde = params.desde || hace(30);
  const hasta = params.hasta || hoy();

  const supabase = await createClient();
  const { data } = await supabase
    .from("movimientos_stock")
    .select(
      "id, tipo, cantidad, motivo, created_at, pedido_id, productos(nombre, categoria, formato), vendedores(nombre)"
    )
    .gte("created_at", `${desde}T00:00:00`)
    .lte("created_at", `${hasta}T23:59:59`)
    .order("created_at", { ascending: false });

  const movimientos = (data ?? []) as unknown as Movimiento[];

  const porDia = new Map<string, Movimiento[]>();
  for (const m of movimientos) {
    const dia = diaChileDe(m.created_at);
    const actual = porDia.get(dia) ?? [];
    actual.push(m);
    porDia.set(dia, actual);
  }
  const dias = [...porDia.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/productos" className="text-sm text-amber-700 hover:underline">
          ← Volver a Productos y stock
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-stone-800">Historial de stock</h1>
        <p className="text-sm text-stone-500">
          Registro de cada carga, salida y ajuste de stock, día por día
        </p>
      </div>

      <form className="flex items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Desde</label>
          <input
            type="date"
            name="desde"
            defaultValue={desde}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Hasta</label>
          <input
            type="date"
            name="hasta"
            defaultValue={hasta}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900"
        >
          Filtrar
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-200 text-xs font-semibold uppercase tracking-wide text-stone-600">
            <tr>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3 text-right">Cantidad</th>
              <th className="px-4 py-3">Motivo</th>
              <th className="px-4 py-3">Quién</th>
              <th className="px-4 py-3">Hora</th>
              {rol === "administrador" && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {dias.map((dia) => {
              const grupo = porDia.get(dia)!;
              return (
                <Fragment key={dia}>
                  <tr className="bg-stone-100">
                    <td
                      colSpan={rol === "administrador" ? 7 : 6}
                      className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-700"
                    >
                      {formatFecha(dia)} · {grupo.length} movimiento
                      {grupo.length === 1 ? "" : "s"}
                    </td>
                  </tr>
                  {grupo.map((m) => (
                    <tr key={m.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-medium text-stone-800">
                        {m.productos?.nombre ?? "Producto"}
                        <span className="ml-1 font-normal text-stone-400">
                          (
                          {m.productos
                            ? `${NOMBRES_CATEGORIA[m.productos.categoria as Categoria]} · ${
                                NOMBRES_FORMATO[m.productos.formato as Formato]
                              }`
                            : "—"}
                          )
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            COLORES_TIPO[m.tipo] ?? "bg-stone-100 text-stone-700"
                          }`}
                        >
                          {NOMBRES_TIPO[m.tipo] ?? m.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-stone-800">
                        {formatoCantidad(m.tipo, m.cantidad)}
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {m.motivo ?? "—"}
                        {m.pedido_id && (
                          <>
                            {" "}
                            <Link
                              href={`/admin/pedidos/${m.pedido_id}`}
                              className="text-amber-700 hover:underline"
                            >
                              Ver pedido
                            </Link>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {m.vendedores?.nombre ?? "Sistema"}
                      </td>
                      <td className="px-4 py-3 text-stone-400">{formatFechaHora(m.created_at)}</td>
                      {rol === "administrador" && (
                        <td className="px-4 py-3 text-right">
                          {m.tipo === "ajuste" && (
                            <EliminarMovimientoButton movimientoId={m.id} />
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            {dias.length === 0 && (
              <tr>
                <td
                  colSpan={rol === "administrador" ? 7 : 6}
                  className="px-4 py-8 text-center text-stone-400"
                >
                  No hay movimientos de stock en este período
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
