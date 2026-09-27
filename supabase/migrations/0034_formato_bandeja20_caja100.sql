-- Agrega los formatos "bandeja_20" y "caja_100" a productos, junto a los
-- ya existentes (bandeja_30, caja_120, caja_180).

alter table public.productos drop constraint productos_formato_check;
alter table public.productos add constraint productos_formato_check
  check (formato in ('bandeja_30', 'caja_120', 'caja_180', 'bandeja_20', 'caja_100'));
