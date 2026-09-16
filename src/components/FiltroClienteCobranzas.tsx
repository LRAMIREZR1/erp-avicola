"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Filtro por cliente en Cobranzas: al elegir uno, navega manteniendo el
// filtro de "pago" que estuviera activo (Todos / Pendientes / Pagados), para
// poder ver por ejemplo "lo pendiente de un cliente" en un solo clic.
export default function FiltroClienteCobranzas({
  clientes,
  clienteIdActual,
  pagoActual,
}: {
  clientes: { id: string; nombre: string }[];
  clienteIdActual?: string;
  pagoActual?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const clienteId = e.target.value;
    const params = new URLSearchParams();
    if (pagoActual) params.set("pago", pagoActual);
    if (clienteId) params.set("cliente_id", clienteId);
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/admin/cobranzas?${query}` : "/admin/cobranzas");
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
