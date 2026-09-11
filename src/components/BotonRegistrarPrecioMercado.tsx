"use client";

import { useFormStatus } from "react-dom";

// Botón de submit del formulario de "Registrar un precio" en Precio de
// mercado. Al hacer clic queda deshabilitado y cambia de texto mientras se
// procesa en el servidor (useFormStatus refleja el estado del <form> que lo
// contiene), así se ve que el clic sí se registró y se evita que, por duda
// o por ansiedad, vuelvan a apretar y quede el precio cargado dos veces.
export default function BotonRegistrarPrecioMercado() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Registrando precio..." : "Registrar precio"}
    </button>
  );
}
