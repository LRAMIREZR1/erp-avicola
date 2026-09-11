-- Abonos parciales a un pedido entregado: cubre el caso de un cliente que
-- se lleva mercadería y va pagando de a poco (ej. a medida que revende las
-- cajas). Cada abono descuenta del saldo pendiente; cuando la suma de
-- abonos alcanza el total del pedido, se marca "pagado" automáticamente.
create table if not exists public.abonos_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  monto numeric not null check (monto > 0),
  fecha date not null default current_date,
  nota text,
  vendedor_id uuid references public.vendedores (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_abonos_pedido_pedido_id on public.abonos_pedido (pedido_id);

alter table public.abonos_pedido enable row level security;

create policy "abonos_pedido select" on public.abonos_pedido
  for select using (public.rol_actual() in ('administrador', 'vendedor'));

create policy "abonos_pedido insert" on public.abonos_pedido
  for insert with check (public.rol_actual() in ('administrador', 'vendedor'));

create policy "abonos_pedido delete" on public.abonos_pedido
  for delete using (public.rol_actual() = 'administrador');
