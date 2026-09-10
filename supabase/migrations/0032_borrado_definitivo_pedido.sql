-- Borrado definitivo de un pedido que ya está en el filtro "Eliminados",
-- para que Administrador pueda limpiar la base de datos sin acumular para
-- siempre pedidos descartados. Solo se permite si el pedido YA está en
-- estado "eliminado" (es decir, ya pasó por el borrado "blando" de
-- eliminar_pedido) — así nunca se salta ese paso intermedio ni se borra por
-- error un pedido que todavía estaba vigente.
--
-- Los ítems del pedido se borran solos (pedido_items tiene "on delete
-- cascade" hacia pedidos). Los movimientos de stock (movimientos_stock) NO
-- se borran — son la auditoría histórica del inventario y deben
-- conservarse aunque el pedido que los originó se elimine — así que antes
-- de borrar el pedido se desvincula esa referencia (pedido_id queda en
-- null) en vez de borrar esas filas.
create or replace function public.eliminar_pedido_definitivo(p_pedido_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_estado text;
begin
  if public.rol_actual() <> 'administrador' then
    raise exception 'Solo un administrador puede borrar definitivamente un pedido';
  end if;

  select estado into v_estado from public.pedidos where id = p_pedido_id;

  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  if v_estado <> 'eliminado' then
    raise exception 'Solo se puede borrar definitivamente un pedido que ya esté en "Eliminados"';
  end if;

  update public.movimientos_stock
  set pedido_id = null
  where pedido_id = p_pedido_id;

  delete from public.pedidos where id = p_pedido_id;
end;
$$;
