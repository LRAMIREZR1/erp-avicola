// Tarea diaria: revisa el stock de alimento proyectado para hoy (mismo
// cálculo "checkpoint + proyección" que usa la página /admin/alimentacion,
// ver src/lib/alimentacion.ts) y, si quedan 7 días o menos, manda un correo
// de aviso para solicitar la compra a tiempo. Si quedan más de 7 días, no
// manda nada — el aviso "vivo" (banner) ya se ve dentro del sistema cada
// vez que alguien entra.
//
// Antes de calcular, también asienta las compras "programadas" (registradas
// con una fecha futura, ver src/app/admin/alimentacion/actions.ts) que ya
// maduraron — para que el checkpoint no quede atrasado indefinidamente si
// nadie abre el sistema el día justo en que una compra programada llega.
//
// Corre desde GitHub Actions (ver .github/workflows/alerta-alimento.yml),
// usando la service_role key de Supabase (variable SUPABASE_SERVICE_KEY) que
// salta las reglas de seguridad (RLS) — por eso este script nunca se ejecuta
// desde el navegador ni desde la app en sí. Reutiliza las mismas variables
// de entorno que sugerencia-precios.mjs (SUPABASE_URL, SUPABASE_SERVICE_KEY,
// GMAIL_USER, GMAIL_APP_PASSWORD) — no hace falta configurar nada nuevo.

import nodemailer from "nodemailer";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DIAS_UMBRAL = 7;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY");
}

function headers() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function obtenerStockAlimento() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/alimento_stock?select=kilos_actual,checkpoint_fecha,gramos_por_gallina&id=eq.principal`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`Error leyendo alimento_stock: ${res.status} ${await res.text()}`);
  const filas = await res.json();
  return filas[0] ?? null;
}

async function obtenerGallinasActivas() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/plantel_gallinas?select=cantidad_actual&id=eq.principal`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`Error leyendo plantel_gallinas: ${res.status} ${await res.text()}`);
  const filas = await res.json();
  return filas[0]?.cantidad_actual ?? 0;
}

// Compras programadas (fecha futura al registrarlas) que ya maduraron —
// fecha <= hoy y todavía no se asentaron en el checkpoint.
async function obtenerCompraPendientesMaduras(hoy) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/alimento_compras?select=id,fecha,kilos&aplicado=eq.false&fecha=lte.${hoy}&order=fecha.asc`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`Error leyendo alimento_compras: ${res.status} ${await res.text()}`);
  return res.json();
}

async function actualizarStock(kilosActual, checkpointFecha) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/alimento_stock?id=eq.principal`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({
      kilos_actual: kilosActual,
      checkpoint_fecha: checkpointFecha,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`Error actualizando alimento_stock: ${res.status} ${await res.text()}`);
}

async function marcarCompraAplicadas(ids) {
  if (ids.length === 0) return;
  const listaIds = ids.map((id) => `"${id}"`).join(",");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/alimento_compras?id=in.(${listaIds})`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ aplicado: true }),
  });
  if (!res.ok) throw new Error(`Error marcando compras aplicadas: ${res.status} ${await res.text()}`);
}

// Fecha de "hoy" en hora de Chile, en formato YYYY-MM-DD — mismo criterio
// que hoyChile() en src/lib/format.ts, para que el cálculo coincida con el
// que ve la app.
function hoyChile() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function sumarDias(fecha, dias) {
  const fechaBase = new Date(`${fecha}T00:00:00Z`);
  fechaBase.setUTCDate(fechaBase.getUTCDate() + dias);
  return fechaBase.toISOString().slice(0, 10);
}

function diasEntre(desde, hasta) {
  const msPorDia = 24 * 60 * 60 * 1000;
  const diff = Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`);
  return Math.max(0, Math.round(diff / msPorDia));
}

// Mismo modelo "checkpoint + proyección" que src/lib/alimentacion.ts —
// duplicado acá a propósito porque este script corre aparte (GitHub
// Actions, JS plano sin el resto de la app) y no puede importar código de
// src/.
function proyectarKilosHoy(stock, gallinasActivas, hoy) {
  const dias = diasEntre(stock.checkpoint_fecha, hoy);
  const consumoDiario = (stock.gramos_por_gallina * gallinasActivas) / 1000;
  return Math.max(0, stock.kilos_actual - consumoDiario * dias);
}

// Asienta (con escritura) las compras programadas que ya maduraron, en
// orden de fecha, igual que asentarCompraPendientes() en
// src/app/admin/alimentacion/actions.ts. Devuelve el checkpoint resultante.
async function asentarCompraPendientes(stock, gallinasActivas, hoy) {
  const pendientes = await obtenerCompraPendientesMaduras(hoy);
  if (pendientes.length === 0) return stock;

  let actual = stock;
  for (const c of pendientes) {
    const kilosEnFecha = proyectarKilosHoy(actual, gallinasActivas, c.fecha) + Number(c.kilos);
    actual = { kilos_actual: kilosEnFecha, checkpoint_fecha: c.fecha, gramos_por_gallina: actual.gramos_por_gallina };
  }

  await actualizarStock(actual.kilos_actual, actual.checkpoint_fecha);
  await marcarCompraAplicadas(pendientes.map((p) => p.id));

  console.log(
    `Se asentaron ${pendientes.length} compra(s) programada(s) que ya maduraron.`
  );

  return actual;
}

async function enviarCorreo({ diasQueQuedan, kilosHoy, consumoDiario, fechaAgotamiento }) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log(
      "Sin credenciales de correo configuradas (GMAIL_USER / GMAIL_APP_PASSWORD) — se omite el envío."
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const asunto =
    diasQueQuedan === 0
      ? "Alimento: el stock se acaba HOY"
      : `Alimento: quedan ${diasQueQuedan} día${diasQueQuedan === 1 ? "" : "s"} de stock`;

  const html = `
    <h2 style="font-family:sans-serif;color:#292524">Alerta de stock de alimento — Avícola Doña Idelia</h2>
    <p style="font-family:sans-serif;color:#57534e;font-size:14px">
      Quedan aproximadamente <strong>${kilosHoy.toFixed(1)} kg</strong> de alimento, a un consumo de
      <strong>${consumoDiario.toFixed(1)} kg/día</strong>. Al ritmo actual, el stock se agotaría el
      <strong>${new Date(`${fechaAgotamiento}T00:00:00`).toLocaleDateString("es-CL")}</strong>.
    </p>
    <p style="font-family:sans-serif;color:#57534e;font-size:14px">
      Conviene solicitar la compra de alimento esta semana para no quedarse sin stock.
    </p>
    <p style="font-family:sans-serif;color:#a8a29e;font-size:12px;margin-top:16px">
      Puedes registrar la compra directamente en el sistema, en "Alimentación".
    </p>
  `;

  await transporter.sendMail({
    from: `Avícola Doña Idelia <${process.env.GMAIL_USER}>`,
    to: process.env.GMAIL_USER,
    subject: asunto,
    html,
  });

  console.log("Correo de alerta enviado.");
}

async function main() {
  let stock = await obtenerStockAlimento();
  if (!stock) {
    console.log("Sin fila de alimento_stock todavía — nada que revisar.");
    return;
  }

  const gallinasActivas = await obtenerGallinasActivas();
  const hoy = hoyChile();

  stock = await asentarCompraPendientes(stock, gallinasActivas, hoy);

  const kilosHoy = proyectarKilosHoy(stock, gallinasActivas, hoy);
  const consumoDiario = (stock.gramos_por_gallina * gallinasActivas) / 1000;

  if (consumoDiario <= 0) {
    console.log("Sin consumo diario configurado (o sin gallinas activas) — no se proyecta agotamiento.");
    return;
  }

  const diasQueQuedan = Math.floor(kilosHoy / consumoDiario);
  const fechaAgotamiento = sumarDias(hoy, diasQueQuedan);

  console.log(
    `Stock estimado hoy: ${kilosHoy.toFixed(1)} kg — consumo: ${consumoDiario.toFixed(1)} kg/día — días restantes: ${diasQueQuedan}`
  );

  if (diasQueQuedan > DIAS_UMBRAL) {
    console.log(`Quedan más de ${DIAS_UMBRAL} días de stock — no se envía alerta.`);
    return;
  }

  await enviarCorreo({ diasQueQuedan, kilosHoy, consumoDiario, fechaAgotamiento });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
