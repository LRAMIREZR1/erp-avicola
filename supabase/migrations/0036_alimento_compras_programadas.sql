-- Permite registrar una compra de alimento con una fecha distinta a hoy —
-- en particular, una compra a futuro (ej: "la compro mañana pero la anoto
-- hoy") que todavía no debe sumarse al stock disponible.
--
-- `aplicado` marca si esta compra ya quedó reflejada en
-- alimento_stock.kilos_actual:
--   - true  → compras de fecha pasada u hoy: se suman al stock de inmediato
--     al registrarlas (comportamiento de siempre; acá la fecha es solo un
--     dato del registro).
--   - false → compras con fecha futura: quedan "pendientes" y se suman
--     solas al stock apenas esa fecha llega — ver asentarCompraPendientes
--     en src/app/admin/alimentacion/actions.ts. La misma lógica corre
--     también en el script diario de GitHub Actions
--     (.github/scripts/alerta-alimento.mjs), para que no dependa de que
--     alguien abra el sistema justo ese día.
--
-- Las filas existentes se marcan aplicado = true porque ya estaban
-- reflejadas en el stock bajo el comportamiento anterior (todas se sumaban
-- de inmediato al registrarlas).

alter table public.alimento_compras
  add column if not exists aplicado boolean not null default true;
