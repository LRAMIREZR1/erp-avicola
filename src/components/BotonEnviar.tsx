"use client";

import { useFormStatus } from "react-dom";

// Botón de submit que muestra su propio estado "enviando" (ej: "Guardando...")
// mientras la acción del formulario está en curso. useFormStatus solo
// funciona dentro de un <form> con una acción de servidor, y solo en un
// componente cliente que sea descendiente del form — por eso es un
// componente aparte en vez de solo un <button> dentro de la página.
export default function BotonEnviar({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
