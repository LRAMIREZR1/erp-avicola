"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Rol } from "@/lib/supabase/types";

interface NavLink {
  href: string;
  label: string;
  roles: Rol[];
}

interface NavSeccion {
  titulo: string | null;
  links: NavLink[];
}

const SECCIONES: NavSeccion[] = [
  {
    titulo: null,
    links: [{ href: "/admin", label: "Resumen", roles: ["administrador", "vendedor"] }],
  },
  {
    titulo: "Ventas",
    links: [
      { href: "/admin/pedidos", label: "Pedidos", roles: ["administrador", "vendedor"] },
      { href: "/admin/ventas", label: "Venta directa", roles: ["administrador"] },
      { href: "/admin/clientes", label: "Clientes", roles: ["administrador", "vendedor"] },
      { href: "/admin/cobranzas", label: "Cobranzas", roles: ["administrador", "vendedor"] },
    ],
  },
  {
    titulo: "Operación",
    links: [
      {
        href: "/admin/produccion",
        label: "Producción diaria",
        roles: ["administrador", "encargado_bodega"],
      },
      {
        href: "/admin/reparto",
        label: "Reparto",
        roles: ["administrador", "vendedor", "encargado_bodega", "repartidor"],
      },
      {
        href: "/admin/productos",
        label: "Productos y stock",
        roles: ["administrador", "vendedor", "encargado_bodega"],
      },
    ],
  },
  {
    titulo: "Administración",
    links: [
      { href: "/admin/reportes", label: "Reportes", roles: ["administrador"] },
      { href: "/admin/usuarios", label: "Usuarios", roles: ["administrador"] },
    ],
  },
];

export default function NavLinks({ rol }: { rol: Rol }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4">
      {SECCIONES.map((seccion, i) => {
        const links = seccion.links.filter((link) => link.roles.includes(rol));
        if (links.length === 0) return null;

        return (
          <div
            key={seccion.titulo ?? `seccion-${i}`}
            className={
              seccion.titulo
                ? "flex flex-col gap-1 rounded-xl border border-stone-200 bg-stone-50 p-2"
                : "flex flex-col gap-1"
            }
          >
            {seccion.titulo && (
              <p className="px-1 pb-1 text-xs font-bold uppercase tracking-wide text-stone-500">
                {seccion.titulo}
              </p>
            )}
            {links.map((link) => {
              const active =
                link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-amber-700 text-white"
                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
