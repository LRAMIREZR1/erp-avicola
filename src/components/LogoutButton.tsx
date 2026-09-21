"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function handleLogout() {
    setSaliendo(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // No se vuelve a habilitar el botón aquí a propósito: debe seguir
    // diciendo "Cerrando sesión..." mientras el router navega a /login, en
    // vez de volver a "Cerrar sesión" por un instante.
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={saliendo}
      className="rounded-lg px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-60"
    >
      {saliendo ? "Cerrando sesión…" : "Cerrar sesión"}
    </button>
  );
}
