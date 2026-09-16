"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCLP, formatFecha } from "@/lib/format";

interface PedidoDetalleVendedor {
  pedidoId: string;
  cliente: string;
  fecha: string;
  total: number;
  unidades: number;
}

export default function DetalleVendedorCard({
  nombre,
  totalVentas,
  cantidadPedidos,
  unidades,
  pedidos,
}: {
  nombre: string;
  totalVentas: number;
  cantidadPedidos: number;
  unidades: number;
  pedidos: PedidoDetalleVendedor[];
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-medium text-stone-800">{nombre}</p>
          <p className="text-xs text-stone-500">
            {cantidadPedidos} pedido{cantidadPedidos === 1 ? "" : "s"} · {unidades} unidades
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-stone-800">{formatCLP(totalVentas)}</span>
          <span className={`text-stone-400 transition-transform ${abierto ? "rotate-180" : ""}`}>
            ▼
          </span>
        </div>
      </button>
      {abierto && (
        <div className="border-t border-stone-100 px-4 py-2">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-stone-400">
              <tr>
                <th className="py-2">Cliente</th>
                <th className="py-2">Fecha</th>
                <th className="py-2">Unidades</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {pedidos.map((p) => (
                <tr key={p.pedidoId}>
                  <td className="py-2">
                    <Link href={`/admin/pedidos/${p.pedidoId}`} className="text-stone-700 hover:underline">
                      {p.cliente}
                    </Link>
                  </td>
                  <td className="py-2 text-stone-500">{formatFecha(p.fecha)}</td>
                  <td className="py-2 text-stone-600">{p.unidades}</td>
                  <td className="py-2 text-right font-medium text-stone-800">{formatCLP(p.total)}</td>
                </tr>
              ))}
              {pedidos.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-stone-400">
                    Sin pedidos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
