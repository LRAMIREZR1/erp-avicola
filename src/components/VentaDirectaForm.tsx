"use client";

import { useMemo, useState } from "react";
import { crearVentaDirecta } from "@/app/admin/ventas/actions";
import { formatCLP } from "@/lib/format";
import type { Cliente, Producto } from "@/lib/supabase/types";

interface Linea {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  precio_lista: number;
}

export default function VentaDirectaForm({
  clientes,
  productos,
  clienteMostradorId,
}: {
  clientes: Cliente[];
  productos: Producto[];
  clienteMostradorId?: string;
}) {
  const [lineas, setLineas] = useState<Linea[]>([
    { producto_id: "", cantidad: 1, precio_unitario: 0, precio_lista: 0 },
  ]);
  const [motivoDescuento, setMotivoDescuento] = useState("");

  const total = useMemo(
    () => lineas.reduce((acc, l) => acc + l.cantidad * l.precio_unitario, 0),
    [lineas]
  );
  const totalLista = useMemo(
    () => lineas.reduce((acc, l) => acc + l.cantidad * l.precio_lista, 0),
    [lineas]
  );
  const descuento = totalLista - total;

  function actualizarLinea(index: number, cambios: Partial<Linea>) {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, ...cambios } : l)));
  }

  function seleccionarProducto(index: number, productoId: string) {
    const producto = productos.find((p) => p.id === productoId);
    actualizarLinea(index, {
      producto_id: productoId,
      precio_unitario: producto?.precio ?? 0,
      precio_lista: producto?.precio ?? 0,
    });
  }

  function agregarLinea() {
    setLineas((prev) => [
      ...prev,
      { producto_id: "", cantidad: 1, precio_unitario: 0, precio_lista: 0 },
    ]);
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
          defaultValue={clienteMostradorId ?? ""}
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
          {clienteMostradorId
            ? "Viene preseleccionado \"Cliente Mostrador\" para ventas al paso sin datos registrados — cámbialo si corresponde a un cliente real."
            : "¿Es alguien que no está registrado? Créalo primero en Clientes."}
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-stone-700">Productos *</p>
        <div className="space-y-2">
          {lineas.map((linea, index) => {
            const conDescuento = linea.precio_unitario < linea.precio_lista;
            return (
              <div key={index} className="space-y-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    value={linea.producto_id}
                    onChange={(e) => seleccionarProducto(index, e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none sm:flex-1"
                  >
                    <option value="">Producto</option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} — {formatCLP(p.precio)} (stock: {p.stock_actual})
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={linea.cantidad}
                      onChange={(e) =>
                        actualizarLinea(index, { cantidad: Number(e.target.value) })
                      }
                      className="w-14 min-w-0 rounded-lg border border-stone-300 px-2 py-2 text-sm sm:w-16"
                      title="Cantidad"
                    />
                    <input
                      type="number"
                      min={0}
                      value={linea.precio_unitario}
                      onChange={(e) =>
                        actualizarLinea(index, { precio_unitario: Number(e.target.value) })
                      }
                      className={`w-20 min-w-0 rounded-lg border px-2 py-2 text-sm sm:w-24 ${
                        conDescuento
                          ? "border-amber-400 bg-amber-50 text-amber-800"
                          : "border-stone-300"
                      }`}
                      title="Precio unitario (editable)"
                    />
                    <span className="flex-1 shrink-0 text-right text-sm text-stone-600 sm:w-24 sm:flex-none">
                      {formatCLP(linea.cantidad * linea.precio_unitario)}
                    </span>
                    <button
                      type="button"
                      onClick={() => quitarLinea(index)}
                      className="shrink-0 text-stone-400 hover:text-red-600"
                      disabled={lineas.length === 1}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {conDescuento && (
                  <p className="pl-1 text-xs text-amber-700">
                    Precio de lista: {formatCLP(linea.precio_lista)} — descuento de{" "}
                    {formatCLP((linea.precio_lista - linea.precio_unitario) * linea.cantidad)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={agregarLinea}
          className="mt-2 text-sm text-amber-700 hover:underline"
        >
          + Agregar producto
        </button>
      </div>

      <div className="space-y-1 border-t border-stone-200 pt-3">
        {descuento > 0.5 && (
          <div className="flex items-center justify-between text-sm text-amber-700">
            <span>Descuento total</span>
            <span>-{formatCLP(descuento)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-stone-700">Total</span>
          <span className="text-lg font-semibold text-stone-800">{formatCLP(total)}</span>
        </div>
      </div>

      {descuento > 0.5 && (
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">
            Motivo del descuento
          </label>
          <input
            type="text"
            name="motivo_descuento"
            value={motivoDescuento}
            onChange={(e) => setMotivoDescuento(e.target.value)}
            placeholder="Ej: pedido grande, cliente frecuente"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
          />
        </div>
      )}
      {descuento <= 0.5 && <input type="hidden" name="motivo_descuento" value="" />}

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
