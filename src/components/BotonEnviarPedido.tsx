"use client";

import { useFormStatus } from "react-dom";

// useFormStatus lee el estado del <form> más cercano (el que usa esta
// función como hijo), así que el botón se deshabilita y cambia de texto
// apenas se envía — antes de que la respuesta del servidor vuelva — para
// que un doble clic no alcance a mandar el pedido dos veces.
export default function BotonEnviarPedido({ modo }: { modo: "crear" | "editar" }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
    >
      {pending
        ? modo === "editar"
          ? "Guardando cambios..."
          : "Creando pedido..."
        : modo === "editar"
          ? "Guardar cambios"
          : "Crear pedido"}
    </button>
  );
}
