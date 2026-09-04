import ProductoForm from "@/components/ProductoForm";

export default function NuevoProductoPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-stone-800">Nuevo producto</h1>
      <ProductoForm />
    </div>
  );
}
