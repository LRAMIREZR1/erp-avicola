-- Snapshot diario del plantel de gallinas activas. plantel_gallinas guarda
-- solo el valor ACTUAL (una sola fila); esta tabla guarda "cuántas gallinas
-- había cada día", para calcular el % de postura histórico con el número
-- real de ese día en vez de tener que reconstruirlo cada vez a partir de la
-- mortandad. Se llena sola:
--   - cada vez que se registra una mortandad o un ajuste de plantel, queda
--     un snapshot de hoy con el valor ya actualizado.
--   - al registrar la producción del día, si todavía no hay snapshot de hoy
--     (porque no hubo mortandad hoy), se crea uno con el valor vigente —
--     que es, por definición, el mismo con el que cerró el día anterior.

create table if not exists public.plantel_gallinas_historico (
  fecha date primary key,
  cantidad integer not null,
  updated_at timestamptz not null default now()
);

alter table public.plantel_gallinas_historico enable row level security;

create policy "plantel_gallinas_historico select" on public.plantel_gallinas_historico
  for select using (public.rol_actual() in ('administrador', 'encargado_bodega'));

create policy "plantel_gallinas_historico insert" on public.plantel_gallinas_historico
  for insert with check (public.rol_actual() in ('administrador', 'encargado_bodega'));

create policy "plantel_gallinas_historico update" on public.plantel_gallinas_historico
  for update using (public.rol_actual() in ('administrador', 'encargado_bodega'));
