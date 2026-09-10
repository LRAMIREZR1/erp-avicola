"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/roles";

// Borra un registro del historial de movimientos de stock Y revierte su
// efecto sobre el stock actual del producto (lo contrario de lo que ese
// movimiento sumó o restó en su momento). Pensado para corregir un error de
// carga — por ejemplo, producción ingresada dos veces — sin tener que además
// ajustar el stock a mano por separado.
//
// Solo se puede borrar así un movimiento que NO esté ligado a un pedido
// (pedido_id es null): las entradas/salidas de pedidos las genera
// automáticamente la base de datos al confirmar/cancelar un pedido, y
// revertirlas desde acá dejaría el pedido y el stock desincronizados. Para
// esos casos existe el flujo propio de cancelar/restaurar el pedido.
export async function eliminarMovimientoStock(id: string) {
  await requireRol(["administrador"]);
  const supabase = await createClient();

  const { data: movimiento } = await supabase
    .from("movimientos_stock")
    .select("id, producto_id, tipo, cantidad, pedido_id")
    .eq("id", id)
    .single();

  // No existe, o está ligado a un pedido: no se toca stock ni se borra. (El
  // botón en la interfaz ya no se muestra para estos casos — esto es un
  // resguardo extra por si se llama igual.)
  if (!movimiento || movimiento.pedido_id) return;

  // Efecto que tuvo el movimiento sobre el stock al crearse, para
  // revertirlo: "entrada" sumó `cantidad`, "salida" restó `cantidad`, y
  // "ajuste" sumó/restó `cantidad` tal cual quedó guardado (puede ser
  // negativo, ej. una merma).
  const efecto =
    movimiento.tipo === "entrada"
      ? movimiento.cantidad
      : movimiento.tipo === "salida"
        ? -movimiento.cantidad
        : movimiento.cantidad;

  const { data: producto } = await supabase
    .from("productos")
    .select("stock_actual")
    .eq("id", movimiento.producto_id)
    .single();

  if (producto) {
    await supabase
      .from("productos")
      .update({ stock_actual: producto.stock_actual - efecto })
      .eq("id", movimiento.producto_id);
  }

  await supabase.from("movimientos_stock").delete().eq("id", id);

  revalidatePath("/admin/productos/movimientos");
  revalidatePath("/admin/productos");
  revalidatePath("/admin/produccion");
  revalidatePath("/admin");
}
