-- ERP Avícola Doña Idelia - esquema inicial
-- Ejecutar en el SQL Editor de tu proyecto Supabase (o vía supabase db push)

-- =========================================
-- 1. VENDEDORES (perfil ligado a auth.users)
-- =========================================
create table if not exists public.vendedores (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  whatsapp text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Crea automáticamente un registro en vendedores cuando se crea un usuario en Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.vendedores (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================
-- 2. CLIENTES
-- =========================================
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null default 'minorista' check (tipo in ('b2b', 'minorista')),
  contacto_nombre text,
  telefono text,
  direccion text,
  zona_entrega text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- =========================================
-- 3. PRODUCTOS (categorías de huevo y formatos de venta)
-- =========================================
create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null check (categoria in ('segunda', 'primera', 'extra')),
  formato text not null check (formato in ('bandeja_30', 'caja_120', 'caja_180')),
  precio numeric(10, 2) not null default 0,
  stock_actual integer not null default 0,
  stock_minimo integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- =========================================
-- 4. PEDIDOS
-- =========================================
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id),
  vendedor_id uuid references public.vendedores (id),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'en_preparacion', 'entregado', 'cancelado')),
  fecha_pedido date not null default current_date,
  fecha_entrega date,
  notas text,
  total numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  producto_id uuid not null references public.productos (id),
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(10, 2) not null,
  subtotal numeric(10, 2) generated always as (cantidad * precio_unitario) stored
);

-- =========================================
-- 5. MOVIMIENTOS DE STOCK (auditoría)
-- =========================================
create table if not exists public.movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos (id),
  tipo text not null check (tipo in ('entrada', 'salida', 'ajuste')),
  cantidad integer not null,
  motivo text,
  pedido_id uuid references public.pedidos (id),
  vendedor_id uuid references public.vendedores (id),
  created_at timestamptz not null default now()
);

-- Recalcula el total del pedido cuando cambian sus ítems
create or replace function public.recalcular_total_pedido()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_pedido_id uuid;
begin
  v_pedido_id := coalesce(new.pedido_id, old.pedido_id);
  update public.pedidos
  set total = (
    select coalesce(sum(subtotal), 0) from public.pedido_items where pedido_id = v_pedido_id
  )
  where id = v_pedido_id;
  return null;
end;
$$;

drop trigger if exists on_pedido_items_change on public.pedido_items;
create trigger on_pedido_items_change
  after insert or update or delete on public.pedido_items
  for each row execute procedure public.recalcular_total_pedido();

-- =========================================
-- 6. ÍNDICES
-- =========================================
create index if not exists idx_pedidos_cliente on public.pedidos (cliente_id);
create index if not exists idx_pedidos_estado on public.pedidos (estado);
create index if not exists idx_pedido_items_pedido on public.pedido_items (pedido_id);
create index if not exists idx_movimientos_producto on public.movimientos_stock (producto_id);

-- =========================================
-- 7. ROW LEVEL SECURITY
-- Panel interno: cualquier usuario autenticado (staff) puede leer/escribir todo.
-- =========================================
alter table public.vendedores enable row level security;
alter table public.clientes enable row level security;
alter table public.productos enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_items enable row level security;
alter table public.movimientos_stock enable row level security;

create policy "staff acceso total vendedores" on public.vendedores
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staff acceso total clientes" on public.clientes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staff acceso total productos" on public.productos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staff acceso total pedidos" on public.pedidos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staff acceso total pedido_items" on public.pedido_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staff acceso total movimientos" on public.movimientos_stock
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- =========================================
-- 8. DATOS INICIALES DE PRODUCTOS (ajusta precios reales)
-- =========================================
insert into public.productos (nombre, categoria, formato, precio, stock_actual, stock_minimo)
values
  ('Huevo Segunda - Bandeja 30', 'segunda', 'bandeja_30', 3000, 0, 20),
  ('Huevo Primera - Bandeja 30', 'primera', 'bandeja_30', 3500, 0, 20),
  ('Huevo Extra - Bandeja 30', 'extra', 'bandeja_30', 4000, 0, 20),
  ('Huevo Primera - Caja 120', 'primera', 'caja_120', 13000, 0, 10),
  ('Huevo Primera - Caja 180', 'primera', 'caja_180', 19000, 0, 10)
on conflict do nothing;
