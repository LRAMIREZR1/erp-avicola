-- "Borrar" un pedido deja de ser un DELETE físico e irreversible: pasa a un
-- nuevo estado "eliminado" (aparece agrupado después de "Cancelado", en su
-- propio filtro "Eliminados"), guardando en estado_anterior en qué estado
-- estaba para poder devolverlo ahí. Reutiliza el trigger de stock que ya
-- existe (aplicar_movimiento_stock_por_pedido): como "eliminado" no está en
-- la lista de estados que comprometen stock, repone automáticamente al
-- eliminar y vuelve a descontar al restaurar, igual que con "cancelado".
-- Queda reservado para Administrador, igual que ya era "Borrar".

alter table public.pedidos drop constraint pedidos_estado_check;
alter table public.pedidos add constraint pedidos_estado_check
  check (estado in ('pendiente', 'confirmado', 'en_preparacion', 'entregado', 'cancelado', 'eliminado'));

alter table public.pedidos add column if not exists estado_anterior text;

create or replace function public.eliminar_pedido(p_pedido_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_estado text;
begin
  if public.rol_actual() <> 'administrador' then
    raise exception 'Solo un administrador puede eliminar un pedido';
  end if;

  select estado into v_estado from public.pedidos where id = p_pedido_id;
  if not found then
    raise exception 'Pedido no encontrado';
  end if;
  if v_estado = 'eliminado' then
    raise exception 'Este pedido ya está eliminado';
  end if;

  update public.pedidos
  set estado_anterior = v_estado, estado = 'eliminado'
  where id = p_pedido_id;
end;
$$;

create or replace function public.restaurar_pedido(p_pedido_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_estado_anterior text;
  v_estado_actual text;
begin
  if public.rol_actual() <> 'administrador' then
    raise exception 'Solo un administrador puede restaurar un pedido';
  end if;

  select estado, estado_anterior into v_estado_actual, v_estado_anterior
  from public.pedidos where id = p_pedido_id;

  if not found then
    raise exception 'Pedido no encontrado';
  end if;
  if v_estado_actual <> 'eliminado' then
    raise exception 'Este pedido no está eliminado';
  end if;

  update public.pedidos
  set estado = coalesce(v_estado_anterior, 'pendiente'), estado_anterior = null
  where id = p_pedido_id;
end;
$$;
