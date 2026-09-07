import { createClient } from "@/lib/supabase/server";
import VentaDirectaForm from "@/components/VentaDirectaForm";
import { requireRol } from "@/lib/roles";

export default async function NuevaVentaDirectaPage() {
  await requireRol(["administrador", "vendedor"]);
  const supabase = await createClient();
  const [clientes, productos] = await Promise.all([
    supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
    supabase.from("productos").select("*").eq("activo", true).order("categoria"),
  ]);

  const clienteMostrador = (clientes.data ?? []).find((c) => c.nombre === "Cliente Mostrador");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Nueva venta directa</h1>
        <p className="text-sm text-stone-500">
          Para ventas al contado que salen de inmediato — descuenta el stock apenas se registra
        </p>
      </div>
      <VentaDirectaForm
        clientes={clientes.data ?? []}
        productos={productos.data ?? []}
        clienteMostradorId={clienteMostrador?.id}
      />
    </div>
  );
}
