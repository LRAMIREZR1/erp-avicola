import { NOMBRES_ESTADO, type EstadoPedido } from "@/lib/supabase/types";

const COLORES: Record<EstadoPedido, string> = {
  pendiente: "bg-stone-100 text-stone-700",
  confirmado: "bg-indigo-100 text-indigo-700",
  en_preparacion: "bg-blue-100 text-blue-700",
  entregado: "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-700",
};

export default function EstadoBadge({ estado }: { estado: EstadoPedido }) {
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${COLORES[estado]}`}>
      {NOMBRES_ESTADO[estado]}
    </span>
  );
}
