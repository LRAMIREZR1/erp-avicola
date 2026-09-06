export type Categoria = "segunda" | "primera" | "extra" | "tercera";
export type Formato = "bandeja_30" | "caja_120" | "caja_180";
export type TipoCliente = "b2b" | "minorista";
export type EstadoPedido =
  | "pendiente"
  | "confirmado"
  | "en_preparacion"
  | "entregado"
  | "cancelado";

export interface Vendedor {
  id: string;
  nombre: string;
  whatsapp: string | null;
  activo: boolean;
  created_at: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  tipo: TipoCliente;
  contacto_nombre: string | null;
  telefono: string | null;
  direccion: string | null;
  zona_entrega: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
}

export interface Producto {
  id: string;
  nombre: string;
  categoria: Categoria;
  formato: Formato;
  precio: number;
  stock_actual: number;
  stock_minimo: number;
  activo: boolean;
  created_at: string;
}

export interface Pedido {
  id: string;
  cliente_id: string;
  vendedor_id: string | null;
  estado: EstadoPedido;
  fecha_pedido: string;
  fecha_entrega: string | null;
  notas: string | null;
  total: number;
  pagado: boolean;
  fecha_pago: string | null;
  created_at: string;
}

export interface PedidoItem {
  id: string;
  pedido_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface MovimientoStock {
  id: string;
  producto_id: string;
  tipo: "entrada" | "salida" | "ajuste";
  cantidad: number;
  motivo: string | null;
  pedido_id: string | null;
  vendedor_id: string | null;
  created_at: string;
}

export const NOMBRES_CATEGORIA: Record<Categoria, string> = {
  segunda: "Segunda",
  primera: "Primera",
  extra: "Extra",
  tercera: "Tercera",
};

export const NOMBRES_FORMATO: Record<Formato, string> = {
  bandeja_30: "Bandeja de 30",
  caja_120: "Caja de 120",
  caja_180: "Caja de 180",
};

export const NOMBRES_ESTADO: Record<EstadoPedido, string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  en_preparacion: "En preparación",
  entregado: "Entregado",
  cancelado: "Cancelado",
};
