import ClienteForm from "@/components/ClienteForm";
import { requireRol } from "@/lib/roles";

export default async function NuevoClientePage() {
  await requireRol(["administrador", "vendedor"]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-stone-800">Nuevo cliente</h1>
      <ClienteForm />
    </div>
  );
}
