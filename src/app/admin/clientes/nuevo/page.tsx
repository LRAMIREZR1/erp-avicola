import ClienteForm from "@/components/ClienteForm";

export default function NuevoClientePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-stone-800">Nuevo cliente</h1>
      <ClienteForm />
    </div>
  );
}
