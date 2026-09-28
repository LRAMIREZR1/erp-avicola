-- Módulo de Costos: gastos generales del negocio (luz, agua, sueldos,
-- insumos, mantención, etc.) — aparte de las compras de alimento, que ya
-- tienen su propio historial en alimento_compras (ese módulo lleva kilos y
-- stock, no plata). Este es solo plata: cuánto, cuándo, en qué categoría,
-- para poder cruzarlo con las ventas en Reportes y sacar el margen.

-- Categorías de costo, editables por el administrador (a diferencia de las
-- categorías de huevo, que son un enum fijo en la base de datos). Parte con
-- una lista sugerida, pero se pueden agregar, renombrar o eliminar desde el
-- sistema.
create table if not exists public.categorias_costo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  created_at timestamptz not null default now()
);

insert into public.categorias_costo (nombre) values
  ('Alimento'),
  ('Servicios básicos'),
  ('Mano de obra'),
  ('Insumos y sanidad'),
  ('Mantención'),
  ('Transporte y combustible'),
  ('Envases y embalaje'),
  ('Arriendo'),
  ('Otros')
on conflict (nombre) do nothing;

create table if not exists public.costos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  -- "on delete restrict": no se puede borrar una categoría mientras tenga
  -- costos registrados con ella (evita dejar costos "huérfanos"); la acción
  -- que intenta el borrado atrapa este error y avisa con un mensaje claro.
  categoria_id uuid not null references public.categorias_costo (id) on delete restrict,
  monto numeric not null check (monto > 0),
  proveedor text,
  notas text,
  vendedor_id uuid references public.vendedores (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_costos_fecha on public.costos (fecha);
create index if not exists idx_costos_categoria on public.costos (categoria_id);

alter table public.categorias_costo enable row level security;
alter table public.costos enable row level security;

-- Información financiera sensible: solo el administrador la ve o la toca,
-- igual que precios de mercado y usuarios.
create policy "categorias_costo select" on public.categorias_costo
  for select using (public.rol_actual() = 'administrador');
create policy "categorias_costo insert" on public.categorias_costo
  for insert with check (public.rol_actual() = 'administrador');
create policy "categorias_costo update" on public.categorias_costo
  for update using (public.rol_actual() = 'administrador');
create policy "categorias_costo delete" on public.categorias_costo
  for delete using (public.rol_actual() = 'administrador');

create policy "costos select" on public.costos
  for select using (public.rol_actual() = 'administrador');
create policy "costos insert" on public.costos
  for insert with check (public.rol_actual() = 'administrador');
create policy "costos delete" on public.costos
  for delete using (public.rol_actual() = 'administrador');
