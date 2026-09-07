-- La pantalla "Venta directa" queda solo para Administrador. Vendedor sigue
-- pudiendo insertar sus propios pedidos normales (origen "pedido"), pero ya
-- no puede insertar filas con origen "venta_directa".

drop policy if exists "pedidos insert" on public.pedidos;
create policy "pedidos insert" on public.pedidos
  for insert with check (
    public.rol_actual() = 'administrador'
    or (
      public.rol_actual() = 'vendedor'
      and vendedor_id = auth.uid()
      and origen <> 'venta_directa'
    )
  );
