-- Perfiles de acceso: administrador, vendedor, encargado_bodega, repartidor.
-- Agrega el rol de cada usuario y reescribe las políticas RLS para que cada
-- perfil solo pueda leer/escribir lo que le corresponde.

alter table public.vendedores
  add column if not exists rol text not null default 'vendedor'
  check (rol in ('administrador', 'vendedor', 'encargado_bodega', 'repartidor'));

-- Deja como administrador a la cuenta indicada (ajusta el correo si hace falta).
update public.vendedores v
set rol = 'administrador'
from auth.users u
where v.id = u.id and u.email = 'lramirezr1@gmail.com';

-- Rol del usuario autenticado actual. security definer para poder consultar
-- la tabla vendedores desde dentro de sus propias políticas sin recursión.
create or replace function public.rol_actual()
returns text
language sql
stable
security definer set search_path = public
as $$
  select rol from public.vendedores where id = auth.uid();
$$;

-- ============ VENDEDORES ============
drop policy if exists "staff acceso total vendedores" on public.vendedores;

create policy "vendedores select" on public.vendedores
  for select using (auth.role() = 'authenticated');

create policy "vendedores update solo admin" on public.vendedores
  for update using (public.rol_actual() = 'administrador')
  with check (public.rol_actual() = 'administrador');

-- ============ CLIENTES ============
-- Datos de contacto (nombre/teléfono/dirección), no financieros: visibles para
-- todo el staff autenticado; solo administrador/vendedor pueden crear o editar.
drop policy if exists "staff acceso total clientes" on public.clientes;

create policy "clientes select" on public.clientes
  for select using (auth.role() = 'authenticated');

create policy "clientes insert" on public.clientes
  for insert with check (public.rol_actual() in ('administrador', 'vendedor'));

create policy "clientes update" on public.clientes
  for update using (public.rol_actual() in ('administrador', 'vendedor'))
  with check (public.rol_actual() in ('administrador', 'vendedor'));

create policy "clientes delete" on public.clientes
  for delete using (public.rol_actual() = 'administrador');

-- ============ PRODUCTOS ============
drop policy if exists "staff acceso total productos" on public.productos;

create policy "productos select" on public.productos
  for select using (auth.role() = 'authenticated');

create policy "productos insert" on public.productos
  for insert with check (public.rol_actual() = 'administrador');

create policy "productos update" on public.productos
  for update using (public.rol_actual() in ('administrador', 'encargado_bodega'))
  with check (public.rol_actual() in ('administrador', 'encargado_bodega'));

create policy "productos delete" on public.productos
  for delete using (public.rol_actual() = 'administrador');

-- ============ PEDIDOS ============
drop policy if exists "staff acceso total pedidos" on public.pedidos;

create policy "pedidos select" on public.pedidos
  for select using (
    public.rol_actual() in ('administrador', 'vendedor')
    or (
      public.rol_actual() in ('repartidor', 'encargado_bodega')
      and estado in ('en_preparacion', 'entregado')
    )
  );

create policy "pedidos insert" on public.pedidos
  for insert with check (public.rol_actual() in ('administrador', 'vendedor'));

create policy "pedidos update" on public.pedidos
  for update using (
    public.rol_actual() in ('administrador', 'vendedor')
    or (public.rol_actual() = 'repartidor' and estado = 'en_preparacion')
  )
  with check (
    public.rol_actual() in ('administrador', 'vendedor')
    or (public.rol_actual() = 'repartidor' and estado = 'entregado')
  );

create policy "pedidos delete" on public.pedidos
  for delete using (public.rol_actual() = 'administrador');

-- ============ PEDIDO_ITEMS ============
drop policy if exists "staff acceso total pedido_items" on public.pedido_items;

create policy "pedido_items select" on public.pedido_items
  for select using (
    public.rol_actual() in ('administrador', 'vendedor')
    or (
      public.rol_actual() in ('repartidor', 'encargado_bodega')
      and exists (
        select 1 from public.pedidos p
        where p.id = pedido_items.pedido_id
          and p.estado in ('en_preparacion', 'entregado')
      )
    )
  );

create policy "pedido_items insert" on public.pedido_items
  for insert with check (public.rol_actual() in ('administrador', 'vendedor'));

create policy "pedido_items update" on public.pedido_items
  for update using (public.rol_actual() in ('administrador', 'vendedor'))
  with check (public.rol_actual() in ('administrador', 'vendedor'));

create policy "pedido_items delete" on public.pedido_items
  for delete using (public.rol_actual() in ('administrador', 'vendedor'));

-- ============ MOVIMIENTOS_STOCK ============
-- (Los triggers de stock automático corren como security definer y no dependen
-- de estas políticas; esto solo rige inserts/lecturas manuales.)
drop policy if exists "staff acceso total movimientos" on public.movimientos_stock;

create policy "movimientos select" on public.movimientos_stock
  for select using (public.rol_actual() in ('administrador', 'encargado_bodega'));

create policy "movimientos insert" on public.movimientos_stock
  for insert with check (public.rol_actual() in ('administrador', 'encargado_bodega'));

create policy "movimientos update" on public.movimientos_stock
  for update using (public.rol_actual() = 'administrador')
  with check (public.rol_actual() = 'administrador');

create policy "movimientos delete" on public.movimientos_stock
  for delete using (public.rol_actual() = 'administrador');
