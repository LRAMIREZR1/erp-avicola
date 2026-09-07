-- Un Vendedor puede seguir viendo un pedido ya entregado, pero no editarlo
-- (ni sus datos ni sus productos), para no modificar el registro de una
-- entrega que ya se hizo. Administrador no tiene esta restricción.

drop policy if exists "pedidos update" on public.pedidos;
create policy "pedidos update" on public.pedidos
  for update using (
    public.rol_actual() = 'administrador'
    or (public.rol_actual() = 'vendedor' and vendedor_id = auth.uid() and estado <> 'entregado')
    or (public.rol_actual() = 'repartidor' and estado = 'en_preparacion')
  )
  with check (
    public.rol_actual() = 'administrador'
    or (public.rol_actual() = 'vendedor' and vendedor_id = auth.uid() and estado <> 'entregado')
    or (public.rol_actual() = 'repartidor' and estado = 'entregado')
  );

drop policy if exists "pedido_items update" on public.pedido_items;
create policy "pedido_items update" on public.pedido_items
  for update using (
    public.rol_actual() = 'administrador'
    or exists (
      select 1 from public.pedidos p
      where p.id = pedido_items.pedido_id
        and public.rol_actual() = 'vendedor'
        and p.vendedor_id = auth.uid()
        and p.estado <> 'entregado'
    )
  )
  with check (
    public.rol_actual() = 'administrador'
    or exists (
      select 1 from public.pedidos p
      where p.id = pedido_items.pedido_id
        and public.rol_actual() = 'vendedor'
        and p.vendedor_id = auth.uid()
        and p.estado <> 'entregado'
    )
  );

drop policy if exists "pedido_items insert" on public.pedido_items;
create policy "pedido_items insert" on public.pedido_items
  for insert with check (
    public.rol_actual() = 'administrador'
    or exists (
      select 1 from public.pedidos p
      where p.id = pedido_items.pedido_id
        and public.rol_actual() = 'vendedor'
        and p.vendedor_id = auth.uid()
        and p.estado <> 'entregado'
    )
  );

drop policy if exists "pedido_items delete" on public.pedido_items;
create policy "pedido_items delete" on public.pedido_items
  for delete using (
    public.rol_actual() = 'administrador'
    or exists (
      select 1 from public.pedidos p
      where p.id = pedido_items.pedido_id
        and public.rol_actual() = 'vendedor'
        and p.vendedor_id = auth.uid()
        and p.estado <> 'entregado'
    )
  );

-- editar_items_pedido corre como security definer y salta las políticas de
-- arriba, así que necesita su propio chequeo del mismo estado.
create or replace function public.editar_items_pedido(p_pedido_id uuid, p_items jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_estado text;
  v_vendedor_id uuid;
  estados_con_stock_comprometido text[] := array['confirmado', 'en_preparacion', 'entregado'];
  compromete boolean;
  item record;
begin
  select estado, vendedor_id into v_estado, v_vendedor_id
  from public.pedidos where id = p_pedido_id;

  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  if public.rol_actual() <> 'administrador'
     and not (public.rol_actual() = 'vendedor' and v_vendedor_id = auth.uid()) then
    raise exception 'No tienes permiso para editar este pedido';
  end if;

  if public.rol_actual() = 'vendedor' and v_estado = 'entregado' then
    raise exception 'No puedes editar un pedido que ya fue entregado';
  end if;

  compromete := v_estado = any(estados_con_stock_comprometido);

  if compromete then
    for item in select producto_id, cantidad from public.pedido_items where pedido_id = p_pedido_id loop
      update public.productos set stock_actual = stock_actual + item.cantidad where id = item.producto_id;
    end loop;
  end if;

  delete from public.pedido_items where pedido_id = p_pedido_id;

  insert into public.pedido_items (pedido_id, producto_id, cantidad, precio_unitario, precio_lista)
  select
    p_pedido_id,
    (elem ->> 'producto_id')::uuid,
    (elem ->> 'cantidad')::integer,
    (elem ->> 'precio_unitario')::numeric,
    coalesce((elem ->> 'precio_lista')::numeric, (elem ->> 'precio_unitario')::numeric)
  from jsonb_array_elements(p_items) as elem;

  if compromete then
    for item in select producto_id, cantidad from public.pedido_items where pedido_id = p_pedido_id loop
      update public.productos set stock_actual = stock_actual - item.cantidad where id = item.producto_id;
    end loop;

    insert into public.movimientos_stock (producto_id, tipo, cantidad, motivo, pedido_id, vendedor_id)
    select producto_id, 'ajuste', cantidad, 'Pedido editado', p_pedido_id, v_vendedor_id
    from public.pedido_items where pedido_id = p_pedido_id;
  end if;
end;
$$;
