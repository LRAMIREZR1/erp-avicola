export function formatCLP(valor: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(valor);
}

export function formatFecha(fecha: string) {
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(new Date(fecha));
}

// Fecha de "hoy" en la zona horaria de Chile (America/Santiago), en formato YYYY-MM-DD.
// El servidor corre en UTC, así que usar new Date().toISOString() directamente hace que,
// desde eso de las 9pm hora Chile en adelante, "hoy" salte al día siguiente antes de tiempo.
export function hoyChile(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
