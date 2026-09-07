-- Cambiar el estado de un pedido (pendiente, confirmado, en preparación,
-- cancelado) queda reservado para Administrador, igual que ya ocurre con el
-- pago. La única excepción es Repartidor, que puede marcar
-- "en_preparacion" -> "entregado" al completar una entrega (botón
-- "Marcar entregado" en Reparto).
-- Se hace con un trigger (no con RLS) porque la restricción es por columna:
-- Vendedor sigue pudiendo editar el resto de su propio pedido, solo no el estado.

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
    else
      raise exception 'Solo un administrador puede cambiar el estado de un pedido';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_pedido_cambio_estado on public.pedidos;
create trigger on_pedido_cambio_estado
  before update on public.pedidos
  for each row execute procedure public.restringir_cambio_estado();
