import { createClient } from "@/lib/supabase/server";
import VentaDirectaForm from "@/components/VentaDirectaForm";

export default async function NuevaVentaDirectaPage() {
  const supabase = await createClient();
  const [clientes, productos] = await Promise.all([
    supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
    supabase.from("productos").select("*").eq("activo", true).order("categoria"),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Nueva venta directa</h1>
        <p className="text-sm text-stone-500">
          Para ventas al contado que salen de inmediato — descuenta el stock apenas se registra
        </p>
      </div>
      <VentaDirectaForm clientes={clientes.data ?? []} productos={productos.data ?? []} />
    </div>
  );
}
