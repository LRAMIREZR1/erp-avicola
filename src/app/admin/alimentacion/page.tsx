import { createClient } from "@/lib/supabase/server";
import { formatFecha, hoyChile, sumarDias } from "@/lib/format";
import { requireRol } from "@/lib/roles";
import {
  registrarCompraAlimento,
  ajustarConsumoAlimento,
  ajustarStockAlimento,
} from "@/app/admin/alimentacion/actions";
import { consumoDiarioKg, diasRestantes, proyectarConPendientes } from "@/lib/alimentacion";
import StatCard from "@/components/StatCard";
import EliminarCompraAlimentoButton from "@/components/EliminarCompraAlimentoButton";
import BotonEnviar from "@/components/BotonEnviar";

export const dynamic = "force-dynamic";

interface CompraEntry {
  id: string;
  fecha: string;
  proveedor: string | null;
  kilos: number;
  notas: string | null;
  aplicado: boolean;
}

export default async function AlimentacionPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; consumo?: string; ajuste?: string }>;
}) {
  const rol = await requireRol(["administrador", "encargado_bodega"]);
  const esAdmin = rol === "administrador";
  const { ok, consumo, ajuste } = await searchParams;
  const supabase = await createClient();
  const hoy = hoyChile();

  const [{ data: stockRow }, { data: plantel }, { data: compras }] = await Promise.all([
    supabase
      .from("alimento_stock")
      .select("kilos_actual, checkpoint_fecha, gramos_por_gallina")
      .eq("id", "principal")
      .single(),
    supabase.from("plantel_gallinas").select("cantidad_actual").eq("id", "principal").single(),
    supabase
      .from("alimento_compras")
      .select("id, fecha, proveedor, kilos, notas, aplicado")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const stock = stockRow ?? {
    kilos_actual: 0,
    checkpoint_fecha: hoy,
    gramos_por_gallina: 0,
  };
  const gallinasActivas = plantel?.cantidad_actual ?? 0;
  const lista = (compras ?? []) as CompraEntry[];

  // Compras a futuro que ya maduraron (llegó su fecha) pero todavía no se
  // asentaron en el checkpoint — puede pasar si nadie hizo ninguna acción
  // en el sistema desde que maduraron. Se incluyen igual en el cálculo de
  // hoy (sin escribir nada acá — eso lo hace la próxima acción, o el
  // script diario) para que el número mostrado sea siempre el correcto.
  const pendientesMaduras = lista
    .filter((c) => !c.aplicado && c.fecha <= hoy)
    .map((c) => ({ fecha: c.fecha, kilos: c.kilos }));

  const kilosHoy = proyectarConPendientes(stock, gallinasActivas, hoy, pendientesMaduras);
  const consumoDiario = consumoDiarioKg(stock.gramos_por_gallina, gallinasActivas);
  const diasQueQuedan = diasRestantes(kilosHoy, consumoDiario);
  const fechaAgotamiento =
    diasQueQuedan !== null ? sumarDias(hoy, diasQueQuedan) : null;

  const alertaActiva =
