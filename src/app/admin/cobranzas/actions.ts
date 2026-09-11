"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hoyChile } from "@/lib/format";
import { obtenerRolActual, requireRol } from "@/lib/roles";

function revalidarCobro(pedidoId: string) {
  revalidatePath("/admin/cobranzas");
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${pedidoId}`);
  revalidatePath("/admin/reportes");
  revalidatePath("/admin");
}

export async function marcarPagado(pedidoId: string, pagado: boolean) {
  "use server";
  const supabase = await createClient();

  await supabase
    .from("pedidos")
    .update({
      pagado,
      fecha_pago: pagado ? hoyChile() : null,
    })
    .eq("id", pedidoId);

  revalidarCobro(pedidoId);
}

// Registra un abono parcial contra un pedido (ej. el cliente va pagando de
// a poco a medida que revende lo que se llevó). No deja abonar más de lo
// que realmente falta, para no dejar un saldo negativo por un error de
// tipeo. Cuando la suma de abonos alcanza el total, el pedido queda
// "pagado" automáticamente — sin necesidad de tocar el botón aparte.
export async function registrarAbono(pedidoId: string, formData: FormData) {
  const rol = await obtenerRolActual();
  if (rol !== "administrador" && rol !== "vendedor") return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const monto = Number(formData.get("monto"));
  const fecha = String(formData.get("fecha") || hoyChile());
  const nota = String(formData.get("nota") || "").trim();

  if (!monto || monto <= 0) {
    revalidarCobro(pedidoId);
    return;
  }

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("total")
    .eq("id", pedidoId)
    .single();
  if (!pedido) return;

  const { data: abonosExistentes } = await supabase
    .from("abonos_pedido")
    .select("monto")
    .eq("pedido_id", pedidoId);
  const totalAbonado = (abonosExistentes ?? []).reduce((acc, a) => acc + Number(a.monto), 0);
  const saldoPendiente = Number(pedido.total) - totalAbonado;

  // Tolerancia de $0.5 por redondeo: no rechaza un abono que calza casi
  // exacto con el saldo.
  if (monto > saldoPendiente + 0.5) {
    revalidarCobro(pedidoId);
    return;
  }

  await supabase.from("abonos_pedido").insert({
    pedido_id: pedidoId,
    monto,
    fecha,
    nota: nota || null,
    vendedor_id: user?.id ?? null,
  });

  if (totalAbonado + monto >= Number(pedido.total) - 0.5) {
    await supabase
      .from("pedidos")
      .update({ pagado: true, fecha_pago: fecha })
      .eq("id", pedidoId);
  }

  revalidarCobro(pedidoId);
}

// Elimina un abono cargado por error. Si el pedido ya estaba marcado como
// pagado gracias a ese abono, y al sacarlo el saldo vuelve a quedar
// pendiente, se revierte el estado "pagado" también.
export async function eliminarAbono(abonoId: string, pedidoId: string) {
  await requireRol(["administrador"]);
  const supabase = await createClient();

  await supabase.from("abonos_pedido").delete().eq("id", abonoId);

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("total, pagado")
    .eq("id", pedidoId)
    .single();

  if (pedido?.pagado) {
    const { data: abonosRestantes } = await supabase
      .from("abonos_pedido")
      .select("monto")
      .eq("pedido_id", pedidoId);
    const totalAbonado = (abonosRestantes ?? []).reduce((acc, a) => acc + Number(a.monto), 0);
    if (totalAbonado < Number(pedido.total) - 0.5) {
      await supabase
        .from("pedidos")
        .update({ pagado: false, fecha_pago: null })
        .eq("id", pedidoId);
    }
  }

  revalidarCobro(pedidoId);
}
