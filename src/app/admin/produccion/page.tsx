  const datosGraficoCajas: ProduccionCajasDatum[] = Array.from({ length: 14 }, (_, i) => {
    const fecha = sumarDias(hoy, -(13 - i));
    const valores = cajasPorDia.get(fecha) ?? { caja120: 0, caja180: 0 };
    return {
      fecha,
      etiqueta: etiquetaDiaCorta(fecha),
      caja120: valores.caja120,
      caja180: valores.caja180,
      totalHuevos: huevosPorDia.get(fecha) ?? 0,
    };
  });
