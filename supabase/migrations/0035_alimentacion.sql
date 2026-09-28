-- Módulo de Alimentación: compras de alimento a proveedores y proyección de
-- cuándo se agota el stock, según el consumo diario (gramos por gallina) y
-- la cantidad de gallinas activas (plantel_gallinas.cantidad_actual).
--
-- alimento_stock, igual que plantel_gallinas, guarda una sola fila (id fijo
-- 'principal') pero NO guarda "cuánto queda hoy" directamente: guarda un
-- checkpoint (kilos_actual + checkpoint_fecha) que se "asienta" en cada
-- compra o ajuste, y la app proyecta el consumo de los días transcurridos
-- desde ese checkpoint para calcular el valor de hoy (ver
-- src/lib/alimentacion.ts). Este diseño evita necesitar un registro diario
-- manual o un cron dentro de la base de datos: el stock "se consume solo"
-- con el paso del tiempo, en el cálculo, no con una fila nueva cada día.

create table if not exists public.alimento_stock (
  id text primary key default 'principal',
  kilos_actual numeric not null default 0,
  checkpoint_fecha date not null default current_date,
  gramos_por_gallina numeric not null default 0,
  updated_at timestamptz not null default now(),
  constraint alimento_stock_id_unico check (id = 'principal')
);

insert into public.alimento_stock (id, kilos_actual, checkpoint_fecha, gramos_por_gallina)
values ('principal', 0, current_date, 0)
on conflict (id) do nothing;

create table if not exists public.alimento_compras (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  proveedor text,
  kilos numeric not null check (kilos > 0),
  costo_total numeric,
  notas text,
  vendedor_id uuid references public.vendedores (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_alimento_compras_fecha on public.alimento_compras (fecha);

alter table public.alimento_stock enable row level security;
alter table public.alimento_compras enable row level security;

create policy "alimento_stock select" on public.alimento_stock
  for select using (public.rol_actual() in ('administrador', 'encargado_bodega'));

create policy "alimento_stock update" on public.alimento_stock
  for update using (public.rol_actual() in ('administrador', 'encargado_bodega'));

create policy "alimento_compras select" on public.alimento_compras
  for select using (public.rol_actual() in ('administrador', 'encargado_bodega'));

create policy "alimento_compras insert" on public.alimento_compras
  for insert with check (public.rol_actual() in ('administrador', 'encargado_bodega'));

create policy "alimento_compras delete" on public.alimento_compras
  for delete using (public.rol_actual() = 'administrador');
