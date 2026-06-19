// ═══════════════════════════════════════════════════════
// QuantStation — Order & Position Types
// ═══════════════════════════════════════════════════════

export type OrderSide = 'BUY' | 'SELL'
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT'
export type OrderStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'PARTIAL_FILL'
  | 'FILLED'
  | 'CANCELLED'
  | 'REJECTED'

export interface Order {
  orderId: string
  symbol: string
  side: OrderSide
  orderType: OrderType
  quantity: number
  limitPrice: number
  stopPrice: number
  status: OrderStatus
  filledQuantity: number
  avgFillPrice: number
  rejectReason: string | null
  ibkrOrderId: number
  createdAt: string
  updatedAt: string
}

export interface Position {
  symbol: string
  quantity: number
  avgCost: number
  marketPrice: number
  unrealizedPnl: number
  realizedPnl: number
  lastUpdated: string
}

export interface PnlSnapshot {
  unrealizedPnl: number
  realizedPnl: number
  totalPnl: number
  timestamp: string
}

export interface OrderRequest {
  symbol: string
  side: OrderSide
  orderType: OrderType
  quantity: number
  limitPrice: number
  stopPrice: number
}
