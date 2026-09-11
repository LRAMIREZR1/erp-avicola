-- Registro de precios de mercado del huevo. No existe una fuente pública
-- con precios mayoristas diarios transados entre avícolas en Chile — es
-- información que circula "de boca en boca" entre productores,
-- distribuidores y compradores — así que esta tabla guarda lo que el
-- usuario (u otra persona de confianza) va anotando día a día.
create table if not exists public.precios_mercado (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  zona text not null check (zona in ('maule', 'santiago', 'otra')),
  -- Categoría es opcional: a veces el precio que circula es "el huevo" en
  -- general, sin desglosar por tamaño.
  categoria text check (categoria in ('super_extra', 'extra', 'primera', 'segunda', 'tercera')),
  unidad text not null default 'kilo'
    check (unidad in ('kilo', 'docena', 'bandeja_30', 'caja_120', 'caja_180')),
  precio numeric not null check (precio > 0),
  -- Quién dio el dato (nombre de la avícola, distribuidor o contacto) — solo
  -- para trazabilidad propia, no se valida contra ninguna tabla.
  fuente text,
  nota text,
  vendedor_id uuid references public.vendedores (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_precios_mercado_fecha on public.precios_mercado (fecha);

alter table public.precios_mercado enable row level security;

create policy "precios_mercado select" on public.precios_mercado
  for select using (public.rol_actual() in ('administrador', 'vendedor'));

create policy "precios_mercado insert" on public.precios_mercado
  for insert with check (public.rol_actual() in ('administrador', 'vendedor'));

create policy "precios_mercado delete" on public.precios_mercado
  for delete using (public.rol_actual() = 'administrador');

-- Referencia oficial semanal de ODEPA: precio AL CONSUMIDOR (supermercados,
-- ferias) en Maule y la Región Metropolitana — no es el precio mayorista
-- entre avícolas, pero sirve como telón de fondo público para comparar. Se
-- publica todos los viernes; como no hay una forma confiable de traerlo
-- automático (el portal de series históricas de ODEPA está dado de baja),
-- se anota a mano cada semana.
create table if not exists public.precios_referencia_odepa (
  id uuid primary key default gen_random_uuid(),
  semana_fecha date not null,
  region text not null check (region in ('maule', 'metropolitana')),
  precio numeric not null check (precio > 0),
  fuente_url text,
  created_at timestamptz not null default now(),
  unique (semana_fecha, region)
);

alter table public.precios_referencia_odepa enable row level security;

create policy "precios_referencia_odepa select" on public.precios_referencia_odepa
  for select using (public.rol_actual() in ('administrador', 'vendedor'));

create policy "precios_referencia_odepa insert" on public.precios_referencia_odepa
  for insert with check (public.rol_actual() = 'administrador');

create policy "precios_referencia_odepa update" on public.precios_referencia_odepa
  for update using (public.rol_actual() = 'administrador');

create policy "precios_referencia_odepa delete" on public.precios_referencia_odepa
  for delete using (public.rol_actual() = 'administrador');
