// Modelo "checkpoint + proyección" para el stock de alimento: en vez de un
// registro diario (que obligaría a entrar todos los días aunque no pase
// nada), alimento_stock guarda solo el último valor conocido (kilos_actual)
// y la fecha en que se guardó (checkpoint_fecha). Para saber cuánto queda
// HOY, se proyecta hacia adelante el consumo de los días transcurridos
// desde ese checkpoint, a la tasa vigente (gramos_por_gallina × gallinas
// activas).
//
// Cualquier acción que vaya a modificar el stock (compra, ajuste de
// consumo, ajuste manual) debe "asentar" primero la proyección de hoy con
// proyectarKilosHoy() — usando la tasa VIGENTE hasta ese momento — antes de
// aplicar su propio cambio. Así, si se cambia gramos_por_gallina, la tasa
// nueva solo rige desde hoy en adelante y no se aplica retroactivamente a
// los días que ya pasaron con la tasa anterior.

export interface AlimentoStockRow {
  kilos_actual: number;
  checkpoint_fecha: string; // YYYY-MM-DD
  gramos_por_gallina: number;
}

// Días completos entre dos fechas YYYY-MM-DD, en aritmética de calendario
// UTC "de mentira" (mismo criterio que sumarDias/diasDesde en
// src/lib/format.ts, para no depender de la hora del servidor). Nunca
// negativo: si por algún motivo "hasta" es anterior a "desde", se trata
// como 0 días transcurridos en vez de restar alimento que no se consumió.
function diasEntre(desde: string, hasta: string): number {
  const msPorDia = 24 * 60 * 60 * 1000;
  const diff = Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`);
  return Math.max(0, Math.round(diff / msPorDia));
}

export function consumoDiarioKg(gramosPorGallina: number, gallinasActivas: number): number {
  return (gramosPorGallina * gallinasActivas) / 1000;
}

// Proyecta cuántos kilos quedan hoy, a partir del último checkpoint guardado
// y la tasa de consumo vigente. Nunca baja de 0.
export function proyectarKilosHoy(
  stock: AlimentoStockRow,
  gallinasActivas: number,
  hoy: string
): number {
  const dias = diasEntre(stock.checkpoint_fecha, hoy);
  const consumo = consumoDiarioKg(stock.gramos_por_gallina, gallinasActivas);
  return Math.max(0, stock.kilos_actual - consumo * dias);
}

// Días de stock que quedan al ritmo de consumo actual. null si no hay
// consumo que proyectar (sin gallinas activas o sin tasa configurada) — en
// ese caso el stock no se agota solo, así que no corresponde avisar.
export function diasRestantes(kilosHoy: number, consumoDiario: number): number | null {
  if (consumoDiario <= 0) return null;
  return Math.floor(kilosHoy / consumoDiario);
}

export interface CompraPendienteInput {
  fecha: string; // YYYY-MM-DD
  kilos: number;
}

// Compras a futuro (fecha posterior a hoy en el momento en que se
// registraron) no se suman al stock de inmediato — quedan "pendientes"
// (alimento_compras.aplicado = false) hasta que esa fecha llega. Esta
// función aplica en memoria, SIN escribir nada, las que ya maduraron
// (fecha <= hoy) sobre un checkpoint base, en orden de fecha — para que la
// proyección de lectura (la página, el banner del Resumen) sea correcta
// aunque todavía no se haya "asentado" esa compra en la base de datos
// (eso lo hace asentarCompraPendientes, en
// src/app/admin/alimentacion/actions.ts, con el mismo cálculo).
// `pendientesMaduras` debe venir ya filtrada a aplicado = false y
// fecha <= hoy.
export function proyectarConPendientes(
  stock: AlimentoStockRow,
  gallinasActivas: number,
  hoy: string,
  pendientesMaduras: CompraPendienteInput[]
): number {
  let actual = stock;
  const ordenadas = [...pendientesMaduras].sort((a, b) =>
    a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0
  );
  for (const c of ordenadas) {
    const kilosEnFecha = proyectarKilosHoy(actual, gallinasActivas, c.fecha) + c.kilos;
    actual = {
      kilos_actual: kilosEnFecha,
      checkpoint_fecha: c.fecha,
      gramos_por_gallina: actual.gramos_por_gallina,
    };
  }
  return proyectarKilosHoy(actual, gallinasActivas, hoy);
}
