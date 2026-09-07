import ProductoForm from "@/components/ProductoForm";
import { requireRol } from "@/lib/roles";

export default async function NuevoProductoPage() {
  await requireRol(["administrador"]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-stone-800">Nuevo producto</h1>
      <ProductoForm />
    </div>
  );
}
