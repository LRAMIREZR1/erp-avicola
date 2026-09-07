"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Rol } from "@/lib/supabase/types";

const LINKS: { href: string; label: string; roles: Rol[] }[] = [
  { href: "/admin", label: "Resumen", roles: ["administrador", "vendedor"] },
  { href: "/admin/pedidos", label: "Pedidos", roles: ["administrador", "vendedor"] },
  { href: "/admin/ventas", label: "Venta directa", roles: ["administrador", "vendedor"] },
  {
    href: "/admin/reparto",
    label: "Reparto",
    roles: ["administrador", "vendedor", "encargado_bodega", "repartidor"],
  },
  { href: "/admin/cobranzas", label: "Cobranzas", roles: ["administrador", "vendedor"] },
  { href: "/admin/clientes", label: "Clientes", roles: ["administrador", "vendedor"] },
  {
    href: "/admin/productos",
    label: "Productos y stock",
    roles: ["administrador", "vendedor", "encargado_bodega"],
  },
  { href: "/admin/reportes", label: "Reportes", roles: ["administrador"] },
  { href: "/admin/usuarios", label: "Usuarios", roles: ["administrador"] },
];

export default function NavLinks({ rol }: { rol: Rol }) {
  const pathname = usePathname();
  const links = LINKS.filter((link) => link.roles.includes(rol));

  return (
    <nav className="flex flex-col gap-1">
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
    </nav>
  );
}
