-- Descuenta stock automáticamente cuando un pedido pasa a estado 'entregado'
-- y revierte el stock si un pedido entregado se cancela.

create or replace function public.aplicar_movimiento_stock_por_pedido()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  item record;
begin
  -- Pasó a 'entregado': descuenta stock de cada línea del pedido
  if new.estado = 'entregado' and (old.estado is distinct from 'entregado') then
    for item in select producto_id, cantidad from public.pedido_items where pedido_id = new.id loop
      update public.productos
      set stock_actual = stock_actual - item.cantidad
      where id = item.producto_id;

      insert into public.movimientos_stock (producto_id, tipo, cantidad, motivo, pedido_id, vendedor_id)
      values (item.producto_id, 'salida', item.cantidad, 'Entrega de pedido', new.id, new.vendedor_id);
    end loop;
  end if;

  -- Un pedido que ya estaba 'entregado' se cancela: repone el stock
  if new.estado = 'cancelado' and old.estado = 'entregado' then
    for item in select producto_id, cantidad from public.pedido_items where pedido_id = new.id loop
      update public.productos
      set stock_actual = stock_actual + item.cantidad
      where id = item.producto_id;

      insert into public.movimientos_stock (producto_id, tipo, cantidad, motivo, pedido_id, vendedor_id)
      values (item.producto_id, 'entrada', item.cantidad, 'Cancelación de pedido entregado', new.id, new.vendedor_id);
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists on_pedido_estado_change on public.pedidos;
create trigger on_pedido_estado_change
  after update of estado on public.pedidos
  for each row execute procedure public.aplicar_movimiento_stock_por_pedido();
