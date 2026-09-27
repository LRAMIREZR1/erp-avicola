-- Agrega la categoría "jumbo", por sobre Super Extra. Es un nombre
-- comercial propio del negocio, no un calibre oficial: la norma chilena
-- NCh1376.of78 solo llega hasta "Especial" (que es lo que este sistema ya
-- venía llamando "Super Extra") — no existe un calibre regulado por sobre
-- ese. Se agrega también al check de precios_mercado para poder registrar
-- ahí un precio de mercado bajo esta categoría si llegara a escucharse uno.

alter table public.productos drop constraint productos_categoria_check;
alter table public.productos add constraint productos_categoria_check
  check (categoria in ('segunda', 'primera', 'extra', 'tercera', 'super_extra', 'jumbo'));

alter table public.precios_mercado drop constraint precios_mercado_categoria_check;
alter table public.precios_mercado add constraint precios_mercado_categoria_check
  check (categoria in ('super_extra', 'extra', 'primera', 'segunda', 'tercera', 'jumbo'));
