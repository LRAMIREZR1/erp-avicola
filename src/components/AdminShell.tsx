"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import NavLinks from "@/components/NavLinks";
import LogoutButton from "@/components/LogoutButton";
import { NOMBRES_ROL, type Rol } from "@/lib/supabase/types";

// Envuelve todo el layout de /admin (header + menú + contenido). Se hizo
// componente de cliente porque el menú necesita estado: en celular no cabe
// fijo al lado del contenido (lo aplasta), así que se esconde detrás de un
// botón de hamburguesa y se abre como panel deslizante sobre la pantalla.
export default function AdminShell({
  nombre,
  rol,
  children,
}: {
  nombre: string;
  rol: Rol;
  children: React.ReactNode;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const pathname = usePathname();

  // Cierra el panel automáticamente al navegar a otra sección.
  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuAbierto(true)}
              className="rounded-lg border border-stone-300 p-1.5 text-stone-600 hover:bg-stone-100 md:hidden"
              aria-label="Abrir menú"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M3 5.5h14M3 10h14M3 14.5h14"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <div>
              <p className="text-sm font-semibold text-stone-800">Avícola Doña Idelia</p>
              <p className="text-xs text-stone-500">Panel interno</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-stone-600 sm:inline">
              {nombre}
              <span className="ml-1.5 text-xs text-stone-400">({NOMBRES_ROL[rol]})</span>
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        {/* Escritorio: menú fijo en la columna izquierda, como antes */}
        <aside className="hidden w-52 shrink-0 print:hidden md:block">
          <NavLinks rol={rol} />
        </aside>

        {/* Celular: el menú aparece como panel deslizante sobre el resto,
            con un fondo oscuro detrás que lo cierra al tocarlo. */}
        {menuAbierto && (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              aria-label="Cerrar menú"
              className="absolute inset-0 bg-stone-900/40"
              onClick={() => setMenuAbierto(false)}
            />
            <div className="absolute inset-y-0 left-0 w-64 max-w-[80vw] overflow-y-auto bg-stone-50 p-4 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-stone-800">Menú</p>
                <button
                  type="button"
                  onClick={() => setMenuAbierto(false)}
                  className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-200"
                  aria-label="Cerrar menú"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path
                      d="M4 4l10 10M14 4L4 14"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              <NavLinks rol={rol} />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
