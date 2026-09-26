"use client";

import { useRouter } from "next/navigation";
import { formatFecha } from "@/lib/format";

// Selector de semana para el reporte de "Sugerencia semanal de precios" —
// navega cambiando el query param ?semana=YYYY-MM-DD, así la página server
// component vuelve a consultar y muestra esa semana.
export default function SemanaSugerenciaSelector({
  semanas,
  actual,
}: {
  semanas: string[];
  actual: string;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="semana-sugerencia" className="text-xs font-medium text-stone-500">
        Semana
      </label>
      <select
        id="semana-sugerencia"
        value={actual}
        onChange={(e) => {
          router.push(`/admin/precio-mercado?semana=${e.target.value}`);
        }}
        className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm focus:border-amber-600 focus:outline-none"
      >
        {semanas.map((semana) => (
          <option key={semana} value={semana}>
            Semana del {formatFecha(semana)}
          </option>
        ))}
      </select>
    </div>
  );
}
