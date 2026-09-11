-- "Precio de mercado" pasa a ser información exclusiva del administrador:
-- el vendedor deja de poder verla o registrarla, tanto en la app como
-- directamente contra la base de datos.
drop policy if exists "precios_mercado select" on public.precios_mercado;
drop policy if exists "precios_mercado insert" on public.precios_mercado;

create policy "precios_mercado select" on public.precios_mercado
  for select using (public.rol_actual() = 'administrador');

create policy "precios_mercado insert" on public.precios_mercado
  for insert with check (public.rol_actual() = 'administrador');
