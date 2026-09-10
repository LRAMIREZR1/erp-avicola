"use client";

import { useMemo, useState } from "react";
import { crearPedido, editarPedido } from "@/app/admin/pedidos/actions";
import { crearClienteRapido } from "@/app/admin/clientes/actions";
import BotonEnviarPedido from "@/components/BotonEnviarPedido";
import { formatCLP } from "@/lib/format";
import type { Cliente, Producto } from "@/lib/supabase/types";

interface Linea {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  precio_lista: number;
}

interface ValoresIniciales {
  cliente_id: string;
  fecha_entrega: string | null;
  notas: string | null;
  motivo_descuento?: string | null;
  pagado?: boolean;
  items: Linea[];
}

export default function PedidoForm({
  clientes,
  productos,
  modo = "crear",
  pedidoId,
  valoresIniciales,
}: {
  clientes: Cliente[];
  productos: Producto[];
  modo?: "crear" | "editar";
  pedidoId?: string;
  valoresIniciales?: ValoresIniciales;
}) {
  const [lineas, setLineas] = useState<Linea[]>(
    valoresIniciales?.items.length
      ? valoresIniciales.items.map((l) => ({
          ...l,
          precio_lista: (l as Linea).precio_lista ?? l.precio_unitario,
        }))
      : [{ producto_id: "", cantidad: 1, precio_unitario: 0, precio_lista: 0 }]
  );
  const [motivoDescuento, setMotivoDescuento] = useState(valoresIniciales?.motivo_descuento ?? "");
  const [listaClientes, setListaClientes] = useState<Cliente[]>(clientes);
  const [clienteId, setClienteId] = useState(valoresIniciales?.cliente_id ?? "");
  const [pagado, setPagado] = useState(valoresIniciales?.pagado ?? false);

  const [mostrarModalCliente, setMostrarModalCliente] = useState(false);
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [errorCliente, setErrorCliente] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState("minorista");
  const [nuevoTelefono, setNuevoTelefono] = useState("");
  const [nuevoDireccion, setNuevoDireccion] = useState("");
  const [nuevaZona, setNuevaZona] = useState("");

  function cerrarModalCliente() {
    setMostrarModalCliente(false);
    setErrorCliente("");
    setNuevoNombre("");
    setNuevoTipo("minorista");
    setNuevoTelefono("");
    setNuevoDireccion("");
    setNuevaZona("");
  }

  async function handleCrearCliente() {
    if (!nuevoNombre.trim()) {
      setErrorCliente("El nombre es obligatorio");
      return;
    }
    setCreandoCliente(true);
    setErrorCliente("");
    try {
      const formData = new FormData();
      formData.set("nombre", nuevoNombre.trim());
      formData.set("tipo", nuevoTipo);
      formData.set("telefono", nuevoTelefono);
      formData.set("direccion", nuevoDireccion);
      formData.set("zona_entrega", nuevaZona);
      const cliente = (await crearClienteRapido(formData)) as Cliente;
      setListaClientes((prev) =>
        [...prev, cliente].sort((a, b) => a.nombre.localeCompare(b.nombre))
      );
      setClienteId(cliente.id);
      cerrarModalCliente();
    } catch (err) {
      setErrorCliente(err instanceof Error ? err.message : "No se pudo crear el cliente");
    } finally {
      setCreandoCliente(false);
    }
  }

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

  const accion = modo === "editar" && pedidoId ? editarPedido.bind(null, pedidoId) : crearPedido;

  return (
    <>
    <form action={accion} className="max-w-2xl space-y-5">
      <input type="hidden" name="items" value={JSON.stringify(lineas)} />

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-sm font-medium text-stone-700">Cliente *</label>
          <button
            type="button"
            onClick={() => setMostrarModalCliente(true)}
            className="text-xs font-medium text-amber-700 hover:underline"
          >
            + Crear cliente
          </button>
        </div>
        <select
          name="cliente_id"
          required
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
        >
          <option value="">Selecciona un cliente</option>
          {listaClientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} {c.tipo === "b2b" ? "(B2B)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">
          Fecha de entrega
        </label>
        <input
          type="date"
          name="fecha_entrega"
          defaultValue={valoresIniciales?.fecha_entrega ?? ""}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
        />
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
      {descuento <= 0.5 && (
        <input type="hidden" name="motivo_descuento" value="" />
      )}

      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          name="pagado"
          checked={pagado}
          onChange={(e) => setPagado(e.target.checked)}
          className="h-4 w-4 rounded border-stone-300"
        />
        El cliente ya pagó (efectivo / transferencia en el momento)
      </label>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Notas</label>
        <textarea
          name="notas"
          rows={2}
          defaultValue={valoresIniciales?.notas ?? ""}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
        />
      </div>

      <BotonEnviarPedido modo={modo} />
    </form>

    {mostrarModalCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-800">Nuevo cliente</h2>
              <button
                type="button"
                onClick={cerrarModalCliente}
                className="text-stone-400 hover:text-stone-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-700">Nombre *</label>
                <input
                  autoFocus
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Hotel Plaza / Juan Pérez"
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-stone-700">Tipo</label>
                <select
                  value={nuevoTipo}
                  onChange={(e) => setNuevoTipo(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                >
                  <option value="minorista">Minorista (bandejas)</option>
                  <option value="b2b">B2B (hotel, hospital, gran volumen)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-stone-700">
                  Teléfono / WhatsApp
                </label>
                <input
                  value={nuevoTelefono}
                  onChange={(e) => setNuevoTelefono(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-stone-700">Dirección</label>
                <input
                  value={nuevoDireccion}
                  onChange={(e) => setNuevoDireccion(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-stone-700">
                  Zona de entrega
                </label>
                <input
                  value={nuevaZona}
                  onChange={(e) => setNuevaZona(e.target.value)}
                  placeholder="San Clemente centro, Talca, etc."
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                />
              </div>

              {errorCliente && <p className="text-xs text-red-600">{errorCliente}</p>}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={cerrarModalCliente}
                className="rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCrearCliente}
                disabled={creandoCliente}
                className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
              >
                {creandoCliente ? "Guardando..." : "Guardar cliente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
