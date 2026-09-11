"use client";

import { useFormStatus } from "react-dom";

// Botón de submit del formulario de "Registrar abono", en el detalle de un
// pedido. Mismo criterio que el resto de la app: se deshabilita y cambia
// de texto mientras se procesa, para que no lo aprieten dos veces.
export default function BotonAbonar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Registrando abono..." : "Registrar abono"}
    </button>
  );
}
