"use client";

import { useMemo, useState } from "react";
import { crearVentaDirecta } from "@/app/admin/ventas/actions";
import { formatCLP } from "@/lib/format";
import type { Cliente, Producto } from "@/lib/supabase/types";

interface Linea {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
}

export default function VentaDirectaForm({
  clientes,
  productos,
}: {
  clientes: Cliente[];
  productos: Producto[];
}) {
  const [lineas, setLineas] = useState<Linea[]>([
    { producto_id: "", cantidad: 1, precio_unitario: 0 },
  ]);

  const total = useMemo(
    () => lineas.reduce((acc, l) => acc + l.cantidad * l.precio_unitario, 0),
    [lineas]
  );

  function actualizarLinea(index: number, cambios: Partial<Linea>) {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, ...cambios } : l)));
  }

  function seleccionarProducto(index: number, productoId: string) {
    const producto = productos.find((p) => p.id === productoId);
    actualizarLinea(index, {
      producto_id: productoId,
      precio_unitario: producto?.precio ?? 0,
    });
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, { producto_id: "", cantidad: 1, precio_unitario: 0 }]);
  }

  function quitarLinea(index: number) {
    setLineas((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form action={crearVentaDirecta} className="max-w-2xl space-y-5">
      <input type="hidden" name="items" value={JSON.stringify(lineas)} />

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Cliente *</label>
        <select
          name="cliente_id"
          required
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
        >
          <option value="">Selecciona un cliente</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} {c.tipo === "b2b" ? "(B2B)" : ""}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-stone-400">
          ¿Es alguien que no está registrado? Créalo primero en Clientes — puede ser algo genérico
          como &quot;Venta mostrador&quot;.
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-stone-700">Productos *</p>
        <div className="space-y-2">
          {lineas.map((linea, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                value={linea.producto_id}
                onChange={(e) => seleccionarProducto(index, e.target.value)}
                className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              >
                <option value="">Producto</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — {formatCLP(p.precio)} (stock: {p.stock_actual})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={linea.cantidad}
                onChange={(e) => actualizarLinea(index, { cantidad: Number(e.target.value) })}
                className="w-20 rounded-lg border border-stone-300 px-2 py-2 text-sm"
              />
              <span className="w-24 text-right text-sm text-stone-600">
                {formatCLP(linea.cantidad * linea.precio_unitario)}
              </span>
              <button
                type="button"
                onClick={() => quitarLinea(index)}
                className="text-stone-400 hover:text-red-600"
                disabled={lineas.length === 1}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={agregarLinea}
          className="mt-2 text-sm text-amber-700 hover:underline"
        >
          + Agregar producto
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-stone-200 pt-3">
        <span className="text-sm font-medium text-stone-700">Total</span>
        <span className="text-lg font-semibold text-stone-800">{formatCLP(total)}</span>
      </div>

      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          name="pagado"
          defaultChecked
          className="h-4 w-4 rounded border-stone-300"
        />
        Pagado al contado (efectivo/transferencia en el momento)
      </label>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Notas</label>
        <textarea
          name="notas"
          rows={2}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
      >
        Registrar venta y descontar stock
      </button>
    </form>
  );
}
