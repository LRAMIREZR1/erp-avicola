-- La migración 0030 le dio permiso a eliminar_pedido() para dejar que un
-- Vendedor elimine su propio pedido pendiente, pero el trigger
-- restringir_cambio_estado() (0015_estado_solo_admin) también se dispara
-- sobre ESE MISMO update de estado (corre a nivel de tabla, sin importar si
-- el update viene de una función security definer) y seguía frenándolo con
-- "Solo un administrador puede cambiar el estado de un pedido". Por eso el
-- pedido no se eliminaba aunque no apareciera ningún error visible en el
-- panel. Este trigger necesita el mismo permiso adicional.

create or replace function public.restringir_cambio_estado()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.estado is distinct from old.estado then
    if public.rol_actual() = 'administrador' then
      return new;
    elsif public.rol_actual() = 'repartidor'
          and old.estado = 'en_preparacion' and new.estado = 'entregado' then
      return new;
    elsif public.rol_actual() = 'vendedor'
          and old.vendedor_id = auth.uid()
          and old.estado = 'pendiente' and new.estado = 'eliminado' then
      return new; -- Vendedor eliminando su propio pedido mientras está pendiente
    else
      raise exception 'Solo un administrador puede cambiar el estado de un pedido';
    end if;
  end if;
  return new;
end;
$$;
