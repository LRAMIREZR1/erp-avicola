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
  // Clases del recuadro y del título de la sección. Cada sección tiene su
  // propio color (más oscuro que un simple bg-stone-50) para que se
  // distingan de un vistazo, sin tener que leer el texto.
  caja?: string;
  tituloColor?: string;
}

const SECCIONES: NavSeccion[] = [
  {
    titulo: null,
    links: [{ href: "/admin", label: "Resumen", roles: ["administrador", "vendedor"] }],
  },
  {
    titulo: "Ventas",
    caja: "border-sky-300 bg-sky-100",
    tituloColor: "text-sky-800",
    links: [
      { href: "/admin/pedidos", label: "Pedidos", roles: ["administrador", "vendedor"] },
      { href: "/admin/ventas", label: "Venta directa", roles: ["administrador"] },
      { href: "/admin/clientes", label: "Clientes", roles: ["administrador", "vendedor"] },
      { href: "/admin/cobranzas", label: "Cobranzas", roles: ["administrador", "vendedor"] },
      {
        href: "/admin/precio-mercado",
        label: "Precio de mercado",
        roles: ["administrador", "vendedor"],
      },
    ],
  },
  {
    titulo: "Operación",
    caja: "border-amber-300 bg-amber-100",
    tituloColor: "text-amber-800",
    links: [
      {
        href: "/admin/produccion",
        label: "Indicadores de producción",
        roles: ["administrador", "encargado_bodega"],
      },
      {
        href: "/admin/productos",
        label: "Productos y stock",
        roles: ["administrador", "vendedor", "encargado_bodega"],
      },
      {
        href: "/admin/produccion/registrar",
        label: "Registrar producción",
        roles: ["administrador", "encargado_bodega"],
      },
      {
        href: "/admin/mortandad",
        label: "Mortandad",
        roles: ["administrador", "encargado_bodega"],
      },
      {
        href: "/admin/reparto",
        label: "Reparto",
        roles: ["administrador", "vendedor", "encargado_bodega", "repartidor"],
      },
    ],
  },
  {
    titulo: "Administración",
    caja: "border-slate-300 bg-slate-200",
    tituloColor: "text-slate-700",
    links: [
      { href: "/admin/reportes", label: "Reportes", roles: ["administrador"] },
      { href: "/admin/usuarios", label: "Usuarios", roles: ["administrador"] },
    ],
  },
];

// Ahora que hay rutas anidadas (/admin/produccion y /admin/produccion/registrar
// son ambas "hijas" de /admin/produccion), un simple pathname.startsWith(href)
// marcaría las dos como activas a la vez estando en /registrar. Por eso se
// busca, entre TODOS los links, el de href más específico (más largo) que
// calce con la ruta actual, y solo ese queda resaltado.
function hrefMasEspecificoQueCalza(pathname: string): string | null {
  const todosLosLinks = SECCIONES.flatMap((s) => s.links);
  const candidatos = todosLosLinks.filter((link) =>
    link.href === "/admin"
      ? pathname === "/admin"
      : pathname === link.href || pathname.startsWith(`${link.href}/`),
  );
  if (candidatos.length === 0) return null;
  return candidatos.reduce((masLargo, actual) =>
    actual.href.length > masLargo.href.length ? actual : masLargo,
  ).href;
}

export default function NavLinks({ rol }: { rol: Rol }) {
  const pathname = usePathname();
  const hrefActivo = hrefMasEspecificoQueCalza(pathname);

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
                ? `flex flex-col gap-1 rounded-xl border p-2 ${seccion.caja}`
                : "flex flex-col gap-1"
            }
          >
            {seccion.titulo && (
              <p
                className={`px-1 pb-1 text-xs font-bold uppercase tracking-wide ${seccion.tituloColor}`}
              >
                {seccion.titulo}
              </p>
            )}
            {links.map((link) => {
              const active = link.href === hrefActivo;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-amber-700 text-white"
                      : seccion.titulo
                        ? "text-stone-700 hover:bg-white/60 hover:text-stone-900"
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
