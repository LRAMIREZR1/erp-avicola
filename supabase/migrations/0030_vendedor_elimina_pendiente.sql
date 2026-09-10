-- Un Vendedor ahora puede eliminar (mover a "Eliminados") sus propios
-- pedidos mientras siguen en estado "pendiente" — mismo criterio que ya
-- rige para editarlos (0017_editar_solo_pendiente). Administrador sigue sin
-- restricciones: puede eliminar cualquier pedido, en cualquier estado.
-- Restaurar un pedido eliminado sigue siendo exclusivo de Administrador.

create or replace function public.eliminar_pedido(p_pedido_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_estado text;
  v_vendedor_id uuid;
begin
  select estado, vendedor_id into v_estado, v_vendedor_id
  from public.pedidos where id = p_pedido_id;

  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  if public.rol_actual() = 'administrador' then
    null; -- sin restricciones
  elsif public.rol_actual() = 'vendedor'
        and v_vendedor_id = auth.uid()
        and v_estado = 'pendiente' then
    null; -- puede eliminar su propio pedido mientras está pendiente
  else
    raise exception 'No tienes permiso para eliminar este pedido';
  end if;

  if v_estado = 'eliminado' then
    raise exception 'Este pedido ya está eliminado';
  end if;

  update public.pedidos
  set estado_anterior = v_estado, estado = 'eliminado'
  where id = p_pedido_id;
end;
$$;
