// Tarea semanal: lee el precio mayorista de Yemita y un precio retail de
// referencia (Cintazul en Jumbo.cl), calcula una sugerencia de precio para
// cada producto propio y la guarda en la tabla `sugerencias_precio` —
// además manda un correo resumen. No cambia ningún precio de venta real,
// solo dice qué convendría cobrar.
//
// Corre desde GitHub Actions (ver .github/workflows/sugerencia-precios.yml),
// usando la service_role key de Supabase (variable SUPABASE_SERVICE_KEY) que
// salta las reglas de seguridad (RLS) — por eso este script nunca se ejecuta
// desde el navegador ni desde la app en sí.
//
// Nota IVA: el precio mayorista de Yemita es Neto (sin IVA), mientras que
// nuestros precios propios (precio_actual) siempre incluyen IVA. Para que la
// sugerencia sea comparable con lo que de verdad cobramos, a los formatos que
// se calculan directo desde Yemita (caja_120, caja_180) se les agrega el 19%
// de IVA antes de aplicar el margen. El formato bandeja_30 no necesita este
// ajuste aparte porque ya se calibra contra el precio retail de Jumbo, que en
// Chile siempre se exhibe al público con IVA incluido.
//
// Huevos Santa Marta (huevo Color, igual que el nuestro) vende exactamente en
// Caja de 6 Bandejas de 30 = 180 unidades — el mismo formato que usamos para
// todos nuestros productos "Caja 180" — y sus precios publicados también
// incluyen IVA (confirmado revisando el desglose del carro de compras:
// subtotal + despacho = total, sin sumar IVA aparte). Por eso, cuando hay
// dato de Santa Marta para la categoría, se usa directo como base para
// Caja 180 (sin necesidad de estimar desde Yemita) — es una comparación
// mucho más directa: mismo formato, mismo color, misma base de IVA.

import nodemailer from "nodemailer";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

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

// --- Productos propios (activos) ---
async function obtenerProductos() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/productos?select=id,nombre,categoria,formato,precio&activo=eq.true`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`Error leyendo productos: ${res.status} ${await res.text()}`);
  return res.json();
}

// --- Precios mayoristas de Yemita ($/huevo), por categoría equivalente ---
// La página publica una tabla "Especial / Extra / Grande / Mediano", que
// corresponde a la norma NCh1376 (Especial=Super Extra, Grande=Primera,
// Mediano=Segunda) — no hay categoría "Tercera" en su tabla, así que ese
// caso se resuelve aparte en calcularSugerencias().
async function obtenerPreciosYemita() {
  const res = await fetch("https://www.yemita.cl/comprar-yemita.php", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; DonaIdeliaBot/1.0)" },
  });
  if (!res.ok) throw new Error(`Yemita no respondió: ${res.status}`);
  const html = await res.text();
  const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const patrones = {
    super_extra: /Especial[^$]{0,60}\$\s?([\d.]+)/i,
    extra: /Extra[^$]{0,60}\$\s?([\d.]+)/i,
    primera: /Grande[^$]{0,60}\$\s?([\d.]+)/i,
    segunda: /Mediano[^$]{0,60}\$\s?([\d.]+)/i,
  };

  const precios = {};
  for (const [categoria, regex] of Object.entries(patrones)) {
    const match = texto.match(regex);
    if (match) precios[categoria] = Number(match[1].replace(/\./g, ""));
  }
  return precios;
}

// --- Precios de Huevos Santa Marta, huevo Color, Caja de 6 Bandejas (30 uni)
// = 180 unidades — mismo formato y color que nuestros productos Caja 180.
// La página trae varias presentaciones por categoría (estuches, packs de 60,
// packs de 150, etc.) a precios muy distintos, y no siempre en el mismo
// orden. IMPORTANTE: no se busca "categoría" y luego "precio" por separado
// — eso causó un bug real (el precio de Primera se emparejó por error con
// el de Tercera, por estar más cerca en el texto esa semana). En su lugar,
// cada coincidencia captura categoría + presentación + precio juntos en un
// solo match, y "(?:(?!HUEVOS)[\s\S])*?" impide que la búsqueda se escape
// hacia la tarjeta del producto siguiente (corta apenas aparece la palabra
// HUEVOS de nuevo) — así el precio queda siempre pegado a su propia
// categoría. Si una categoría no tiene esta presentación esa semana (ej.
// Super Extra), simplemente no aparece en el resultado y
// calcularSugerencias() usa el respaldo de Yemita para esa categoría.
const NOMBRE_A_CATEGORIA_SANTA_MARTA = {
  "SUPER EXTRA": "super_extra",
  EXTRA: "extra",
  PRIMERA: "primera",
  SEGUNDA: "segunda",
  TERCERA: "tercera",
};

async function obtenerPreciosSantaMarta() {
  const res = await fetch(
    "https://www.huevossantamarta.cl/productos/linea/1/huevos/dest?ma=&ta=&co=&em=&ca=5",
    { headers: { "User-Agent": "Mozilla/5.0 (compatible; DonaIdeliaBot/1.0)" } }
  );
  if (!res.ok) throw new Error(`Huevos Santa Marta no respondió: ${res.status}`);
  const html = await res.text();
  const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const regexEntrada =
    /HUEVOS ([A-ZÁÉÍÓÚÑ ]+?) COLOR(?:(?!HUEVOS)[\s\S])*?CAJA DE 6 BANDEJAS(?:(?!HUEVOS)[\s\S])*?180 UNIDADES(?:(?!HUEVOS)[\s\S])*?\$\s?([\d.]+)/gi;

  const precios = {};
  for (const match of texto.matchAll(regexEntrada)) {
    const categoria = NOMBRE_A_CATEGORIA_SANTA_MARTA[match[1].trim().toUpperCase()];
    if (categoria && !(categoria in precios)) {
      precios[categoria] = Number(match[2].replace(/\./g, ""));
    }
  }
  return precios;
}

// --- Precios de Agricovial, línea Gallina Libre Color, Caja de 180 unidades
// — solo tienen Primera y Extra en esta línea (no Segunda ni Tercera ni
// Super Extra). Confirmado en el checkout de su sitio (columna "Total IVA
// incl.") que el precio publicado ya incluye IVA, igual que Santa Marta. Se
// scrapea la página de categoría (no la ficha de cada producto individual —
// esa mostró un precio distinto e inconsistente para Extra la primera vez
// que se revisó a mano).
async function obtenerPreciosAgricovial() {
  const res = await fetch("https://www.agricovial.cl/categoria-producto/gallina-libre/", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; DonaIdeliaBot/1.0)" },
  });
  if (!res.ok) throw new Error(`Agricovial no respondió: ${res.status}`);
  const html = await res.text();
  const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const patrones = {
    primera: /Huevo Color Primera Gallina Libre[^$]{0,150}\$\s?([\d.]+)/i,
    extra: /Huevo Color Extra Gallina Libre[^$]{0,150}\$\s?([\d.]+)/i,
  };

  const precios = {};
  for (const [categoria, regex] of Object.entries(patrones)) {
    const match = texto.match(regex);
    if (match) precios[categoria] = Number(match[1].replace(/\./g, ""));
  }
  return precios;
}

// --- Precio retail de referencia: Cintazul Grande, bandeja de 30, en Jumbo.cl ---
// Se usa solo para calibrar la relación entre precio mayorista y precio al
// público — si esta lectura falla (la página cambió, bloqueo, etc.) el
// script sigue funcionando con un valor de respaldo, no se cae.
async function obtenerPrecioRetailJumbo() {
  const res = await fetch(
    "https://www.jumbo.cl/huevos-grandes-color-cintazul-bandeja-30-unid/p",
    { headers: { "User-Agent": "Mozilla/5.0 (compatible; DonaIdeliaBot/1.0)" } }
  );
  if (!res.ok) throw new Error(`Jumbo no respondió: ${res.status}`);
  const html = await res.text();

  // Primero intenta con los datos estructurados (JSON-LD) que las páginas de
  // producto suelen traer para buscadores — más confiable que buscar el
  // primer "$" del HTML, que podría ser de otro producto.
  const bloques = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const bloque of bloques) {
    try {
      const datos = JSON.parse(bloque[1]);
      const candidatos = Array.isArray(datos) ? datos : [datos];
      for (const d of candidatos) {
        const precio = d?.offers?.price ?? d?.offers?.[0]?.price;
        if (precio) return Number(precio);
      }
    } catch {
      // sigue con el próximo bloque de datos
    }
  }

  // Respaldo: busca un precio cerca de la palabra "Cintazul" en el texto.
  const texto = html.replace(/\s+/g, " ");
  const match = texto.match(/Cintazul[^$]{0,200}\$\s?([\d.]{4,7})/i);
  return match ? Number(match[1].replace(/\./g, "")) : null;
}

const RATIO_RETAIL_RESPALDO = 2.7; // observado manualmente, sept. 2026
const IVA = 0.19; // IVA Chile — Yemita cotiza Neto, nuestros precios son con IVA

// Orden de calidad usado para mostrar los reportes (email y página) siempre
// en el mismo orden, de mejor a peor categoría.
const ORDEN_CATEGORIA = {
  super_extra: 0,
  extra: 1,
  primera: 2,
  segunda: 3,
  tercera: 4,
};

function categoriaReferenciaYemita(categoria) {
  // "Tercera" no existe en la tabla de Yemita — se aproxima con "Segunda"
  // aplicando además un descuento extra (ver factorTercera más abajo).
  return categoria === "tercera" ? "segunda" : categoria;
}

function unidadesPorFormato(formato) {
  if (formato === "bandeja_30") return 30;
  if (formato === "caja_120") return 120;
  return 180; // caja_180
}

function calcularSugerencias(
  productos,
  preciosYemita,
  precioRetailJumbo,
  preciosSantaMarta = {},
  preciosAgricovial = {}
) {
  const precioMayoristaGrande30 = (preciosYemita.primera ?? 0) * 30;
  const ratioRetail =
    precioRetailJumbo && precioMayoristaGrande30
      ? precioRetailJumbo / precioMayoristaGrande30
      : RATIO_RETAIL_RESPALDO;

  const sugerencias = [];

  for (const p of productos) {
    const catRef = categoriaReferenciaYemita(p.categoria);
    const precioHuevo = preciosYemita[catRef];
    if (!precioHuevo) continue; // sin dato de competencia esta semana para esta categoría

    const factorTercera = p.categoria === "tercera" ? 0.93 : 1;
    const precioHuevoConIva = precioHuevo * (1 + IVA);
    const unidades = unidadesPorFormato(p.formato);
    // Referencia: cuánto costaría comprar esa misma cantidad de huevos a
    // Yemita, agregando el 19% de IVA — para comparar contra precio_actual
    // (que siempre incluye IVA) en igualdad de condiciones.
    const precioYemitaConIvaEquivalente = precioHuevoConIva * unidades * factorTercera;

    let precioSugerido;
    let metodo;
    // Nombre y valor de la referencia que realmente se usa como base del
    // cálculo para este producto — para mostrarla tal cual en el correo y en
    // pantalla, en vez de mostrar siempre "Yemita" aunque no sea la fuente
    // real (ese era el problema: Bandeja 30 se calcula desde Cintazul/Jumbo,
    // no desde Yemita, pero la columna anterior mostraba Yemita igual).
    let referenciaFuente;
    let referenciaValor;

    // Precios de la competencia en esta categoría exacta (Caja 180, huevo
    // Color) — ambos ya incluyen IVA, no necesitan ningún ajuste extra.
    // Agricovial solo tiene Primera y Extra (no Segunda/Tercera/Super
    // Extra), así que para esas categorías esto queda vacío.
    const precioSantaMarta = preciosSantaMarta[p.categoria] ?? null;
    const precioAgricovial = preciosAgricovial[p.categoria] ?? null;

    if (p.formato === "bandeja_30") {
      const retailEstimado = precioHuevo * 30 * ratioRetail * factorTercera;
      precioSugerido = retailEstimado * 0.88; // ~12% bajo el retail estimado
      metodo = "12% bajo el precio retail estimado (calibrado con Cintazul en Jumbo, ya incluye IVA)";
      referenciaFuente = "Cintazul/Jumbo (retail estimado)";
      referenciaValor = Math.round(retailEstimado);
    } else if (p.formato === "caja_120") {
      precioSugerido = precioHuevoConIva * 120 * factorTercera * 1.05;
      metodo = "5% sobre el precio mayorista de Yemita + IVA (venta media)";
      referenciaFuente = "Yemita + IVA";
      referenciaValor = Math.round(precioHuevoConIva * 120 * factorTercera);
    } else if (precioSantaMarta || precioAgricovial) {
      // Mismo formato exacto (Caja 180, huevo Color) y precio ya con IVA en
      // ambos — comparación directa, sin estimaciones. Si están los dos, se
      // usa el promedio; si solo hay uno, se usa ese.
      const referencias = [];
      if (precioSantaMarta) referencias.push({ fuente: "Huevos Santa Marta", valor: precioSantaMarta });
      if (precioAgricovial) referencias.push({ fuente: "Agricovial", valor: precioAgricovial });
      const promedio = referencias.reduce((suma, r) => suma + r.valor, 0) / referencias.length;

      precioSugerido = promedio * 0.97; // 3% bajo el promedio de competencia
      const nombresFuentes = referencias.map((r) => r.fuente).join(" y ");
      metodo = `3% bajo ${nombresFuentes} (misma Caja 180, huevo color, precio ya con IVA)`;
      referenciaFuente = referencias.length > 1 ? `Promedio: ${nombresFuentes}` : nombresFuentes;
      referenciaValor = Math.round(promedio);
    } else {
      precioSugerido = precioHuevoConIva * 180 * factorTercera * 0.97;
      metodo =
        "3% bajo el precio mayorista de Yemita + IVA (sin dato de Santa Marta ni Agricovial esta semana para esta categoría)";
      referenciaFuente = "Yemita + IVA";
      referenciaValor = Math.round(precioYemitaConIvaEquivalente);
    }

    precioSugerido = Math.round(precioSugerido / 50) * 50;

    sugerencias.push({
      producto_id: p.id,
      precio_actual: p.precio,
      precio_sugerido: precioSugerido,
      detalle: {
        metodo,
        referencia_fuente: referenciaFuente,
        referencia_valor: referenciaValor,
        precio_santa_marta: precioSantaMarta,
        precio_agricovial: precioAgricovial,
        precio_yemita_por_huevo: precioHuevo,
        precio_yemita_con_iva_por_huevo: Number(precioHuevoConIva.toFixed(2)),
        precio_yemita_con_iva_equivalente: Math.round(precioYemitaConIvaEquivalente),
        categoria_referencia_yemita: catRef,
        ratio_retail_usado: Number(ratioRetail.toFixed(2)),
        retail_jumbo_disponible_esta_semana: precioRetailJumbo != null,
      },
    });
  }

  return sugerencias;
}

async function guardarSugerencias(sugerencias) {
  const semana_fecha = new Date().toISOString().slice(0, 10);
  const filas = sugerencias.map((s) => ({ ...s, semana_fecha }));

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sugerencias_precio?on_conflict=semana_fecha,producto_id`,
    {
      method: "POST",
      headers: { ...headers(), Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(filas),
    }
  );
  if (!res.ok) throw new Error(`Error guardando sugerencias: ${res.status} ${await res.text()}`);
  return res.json();
}

function formatCLP(n) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

async function enviarCorreo(productos, sugerencias) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log("Sin credenciales de correo configuradas (GMAIL_USER / GMAIL_APP_PASSWORD) — se omite el envío.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const porId = new Map(productos.map((p) => [p.id, p]));
  const conProducto = sugerencias
    .map((s) => ({ s, p: porId.get(s.producto_id) }))
    .filter(({ p }) => p);

  // El reporte va separado en dos bloques — Bandejas (venta más chica, al
  // detalle) y Cajas (venta grande, B2B) — en vez de una sola lista
  // mezclada, para que sea más fácil de leer de un vistazo. Dentro de cada
  // bloque, siempre en el mismo orden de calidad: Super Extra, Extra,
  // Primera, Segunda, Tercera.
  const ordenPorCategoria = (lista) =>
    [...lista].sort(
      (a, b) =>
        (ORDEN_CATEGORIA[a.p.categoria] ?? 99) -
        (ORDEN_CATEGORIA[b.p.categoria] ?? 99)
    );
  const bandejas = ordenPorCategoria(
    conProducto.filter(({ p }) => p.formato === "bandeja_30")
  );
  const cajas = ordenPorCategoria(
    conProducto.filter(({ p }) => p.formato !== "bandeja_30")
  );

  const filaHtml = (s, p) => {
    const diff = s.precio_sugerido - s.precio_actual;
    const color = diff > 0 ? "#15803d" : diff < 0 ? "#b91c1c" : "#78716c";
    const signo = diff > 0 ? "+" : "";
    const referenciaValor = s.detalle?.referencia_valor;
    const referenciaFuente = s.detalle?.referencia_fuente;
    return `<tr>
      <td style="padding:4px 8px;border-bottom:1px solid #e7e5e4">${p.nombre}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #e7e5e4;text-align:right">${formatCLP(p.precio)}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #e7e5e4;text-align:right;color:#78716c">${
        referenciaValor != null ? formatCLP(referenciaValor) : "—"
      }<br/><span style="font-size:11px;color:#a8a29e">${referenciaFuente ?? ""}</span></td>
      <td style="padding:4px 8px;border-bottom:1px solid #e7e5e4;text-align:right;font-weight:bold">${formatCLP(s.precio_sugerido)}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #e7e5e4;text-align:right;color:${color}">${signo}${formatCLP(diff)}</td>
    </tr>`;
  };

  const tablaSeccion = (titulo, lista) => {
    if (lista.length === 0) return "";
    return `
      <h3 style="font-family:sans-serif;color:#44403c;font-size:14px;margin:20px 0 8px">${titulo}</h3>
      <table style="border-collapse:collapse;width:100%;max-width:680px;font-family:sans-serif;font-size:13px">
        <thead>
          <tr style="background:#f5f5f4;text-align:left">
            <th style="padding:4px 8px">Producto</th>
            <th style="padding:4px 8px;text-align:right">Precio actual</th>
            <th style="padding:4px 8px;text-align:right">Referencia</th>
            <th style="padding:4px 8px;text-align:right">Sugerido</th>
            <th style="padding:4px 8px;text-align:right">Diferencia</th>
          </tr>
        </thead>
        <tbody>${lista.map(({ s, p }) => filaHtml(s, p)).join("")}</tbody>
      </table>
    `;
  };

  const html = `
    <h2 style="font-family:sans-serif;color:#292524">Sugerencia semanal de precios — Avícola Doña Idelia</h2>
    <p style="font-family:sans-serif;color:#57534e;font-size:14px">
      "Referencia" es el precio de la competencia que efectivamente se usó ese producto esa
      semana — Huevos Santa Marta y/o Agricovial (mismo formato Caja 180, huevo color; si están
      los dos, es el promedio), Yemita (mayorista, con 19% de IVA agregado) o Cintazul/Jumbo
      (retail estimado) — ya en la misma base que nuestro precio (con IVA incluido). Esto es
      solo una sugerencia — nada se cambia solo en el sistema, tú decides si ajustar cada precio
      desde "Productos y stock".
    </p>
    ${tablaSeccion("Bandejas (30 unidades)", bandejas)}
    ${tablaSeccion("Cajas", cajas)}
    <p style="font-family:sans-serif;color:#a8a29e;font-size:12px;margin-top:16px">
      Detalle completo en el sistema, en "Precio de mercado del huevo".
    </p>
  `;

  await transporter.sendMail({
    from: `Avícola Doña Idelia <${process.env.GMAIL_USER}>`,
    to: process.env.GMAIL_USER,
    subject: `Sugerencia de precios — semana del ${new Date().toLocaleDateString("es-CL")}`,
    html,
  });

  console.log("Correo enviado.");
}

async function main() {
  const productos = await obtenerProductos();
  console.log(`Productos activos: ${productos.length}`);

  let preciosYemita;
  try {
    preciosYemita = await obtenerPreciosYemita();
  } catch (err) {
    console.error("No se pudo leer Yemita:", err.message);
    preciosYemita = {};
  }

  if (Object.keys(preciosYemita).length === 0) {
    console.log("Sin precios de Yemita esta semana — no se generan sugerencias.");
    return;
  }
  console.log("Precios Yemita ($/huevo):", preciosYemita);

  let precioRetailJumbo = null;
  try {
    precioRetailJumbo = await obtenerPrecioRetailJumbo();
    console.log("Precio retail Jumbo (Cintazul Grande, bandeja 30):", precioRetailJumbo);
  } catch (err) {
    console.error("No se pudo leer Jumbo, se usa ratio de respaldo:", err.message);
  }

  let preciosSantaMarta = {};
  try {
    preciosSantaMarta = await obtenerPreciosSantaMarta();
    console.log("Precios Huevos Santa Marta, Caja 180 (ya con IVA):", preciosSantaMarta);
  } catch (err) {
    console.error(
      "No se pudo leer Huevos Santa Marta, se usa Yemita+IVA de respaldo para Caja 180:",
      err.message
    );
  }

  let preciosAgricovial = {};
  try {
    preciosAgricovial = await obtenerPreciosAgricovial();
    console.log("Precios Agricovial, Gallina Libre Caja 180 (ya con IVA):", preciosAgricovial);
  } catch (err) {
    console.error("No se pudo leer Agricovial, se sigue solo con Santa Marta/Yemita:", err.message);
  }

  const sugerencias = calcularSugerencias(
    productos,
    preciosYemita,
    precioRetailJumbo,
    preciosSantaMarta,
    preciosAgricovial
  );

  if (sugerencias.length === 0) {
    console.log("No se generó ninguna sugerencia (sin categorías equivalentes).");
    return;
  }

  await guardarSugerencias(sugerencias);
  console.log(`Guardadas ${sugerencias.length} sugerencias.`);

  await enviarCorreo(productos, sugerencias);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
