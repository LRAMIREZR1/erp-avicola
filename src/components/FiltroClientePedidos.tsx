"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function FiltroClientePedidos({
  clientes,
  clienteIdActual,
  estadoActual,
  ordenActual,
}: {
  clientes: { id: string; nombre: string }[];
  clienteIdActual?: string;
  estadoActual?: string;
  ordenActual?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const clienteId = e.target.value;
    const params = new URLSearchParams();
    if (estadoActual) params.set("estado", estadoActual);
    if (ordenActual) params.set("orden", ordenActual);
    if (clienteId) params.set("cliente_id", clienteId);
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/admin/pedidos?${query}` : "/admin/pedidos");
    });
  }

  return (
    <select
      value={clienteIdActual ?? ""}
      onChange={handleChange}
      disabled={pending}
      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:border-amber-600 focus:outline-none disabled:opacity-60 sm:w-64"
    >
      <option value="">{pending ? "Filtrando..." : "Todos los clientes"}</option>
      {clientes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nombre}
        </option>
      ))}
    </select>
  );
}
