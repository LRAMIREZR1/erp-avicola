import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/AdminShell";
import { type Rol } from "@/lib/supabase/types";

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
    <AdminShell nombre={vendedor?.nombre ?? user.email ?? ""} rol={rol}>
      {children}
    </AdminShell>
  );
}
