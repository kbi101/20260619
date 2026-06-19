// ═══════════════════════════════════════════════════════
// QuantStation — Zustand Store
// ═══════════════════════════════════════════════════════
// Single store driven by WebSocket updates from Spring Boot

import { create } from 'zustand'
import type { Tick } from '../types/market'
import type { Order, Position, PnlSnapshot } from '../types/order'

interface QuantStationState {
  // Connection
  connected: boolean
  setConnected: (connected: boolean) => void

  // Market data
  ticks: Record<string, Tick>
  updateTick: (tick: Tick) => void

  // Orders
  orders: Order[]
  updateOrder: (order: Order) => void

  // Positions
  positions: Record<string, Position>
  updatePosition: (position: Position) => void

  // PnL
  pnl: PnlSnapshot
  updatePnl: (pnl: PnlSnapshot) => void

  // Active symbol
  activeSymbol: string
  setActiveSymbol: (symbol: string) => void
}

export const useStore = create<QuantStationState>((set) => ({
  // Connection
  connected: false,
  setConnected: (connected) => set({ connected }),

  // Market data — keyed by symbol for O(1) lookups
  ticks: {},
  updateTick: (tick) =>
    set((state) => ({
      ticks: { ...state.ticks, [tick.symbol]: tick },
    })),

  // Orders — array with upsert logic
  orders: [],
  updateOrder: (order) =>
    set((state) => {
      const idx = state.orders.findIndex((o) => o.orderId === order.orderId)
      if (idx >= 0) {
        const updated = [...state.orders]
        updated[idx] = order
        return { orders: updated }
      }
      return { orders: [order, ...state.orders] }
    }),

  // Positions — keyed by symbol
  positions: {},
  updatePosition: (position) =>
    set((state) => ({
      positions: { ...state.positions, [position.symbol]: position },
    })),

  // PnL
  pnl: { unrealizedPnl: 0, realizedPnl: 0, totalPnl: 0, timestamp: '' },
  updatePnl: (pnl) => set({ pnl }),

  // Active symbol
  activeSymbol: 'SPY',
  setActiveSymbol: (symbol) => set({ activeSymbol: symbol }),
}))
