import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NavLinks from "@/components/NavLinks";
import LogoutButton from "@/components/LogoutButton";
import { NOMBRES_ROL, type Rol } from "@/lib/supabase/types";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: vendedor } = await supabase
    .from("vendedores")
    .select("nombre, rol")
    .eq("id", user.id)
    .single();

  const rol = (vendedor?.rol as Rol | undefined) ?? "vendedor";

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-stone-800">Avícola Doña Idelia</p>
            <p className="text-xs text-stone-500">Panel interno</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-600">
              {vendedor?.nombre ?? user.email}
              <span className="ml-1.5 text-xs text-stone-400">({NOMBRES_ROL[rol]})</span>
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside className="w-52 shrink-0 print:hidden">
          <NavLinks rol={rol} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
