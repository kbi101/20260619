// ═══════════════════════════════════════════════════════
// QuantStation — Zustand Store
// ═══════════════════════════════════════════════════════
// Single store driven by WebSocket updates from Spring Boot

import { create } from 'zustand'
import type { Tick } from '../types/market'
import type { Order, Position, PnlSnapshot } from '../types/order'

export interface WatchlistTicker {
  symbol: string
  prevClose: number
  atr: number
  rvol: number
  companyName: string
}

interface QuantStationState {
  // Connection
  connected: boolean
  setConnected: (connected: boolean) => void
  ibkrConnected: boolean
  setIbkrConnected: (ibkrConnected: boolean) => void

  // Market data
  ticks: Record<string, Tick>
  updateTick: (tick: Tick) => void

  // Watchlist
  watchlist: WatchlistTicker[]
  addWatchlistSymbol: (symbol: string) => void
  removeWatchlistSymbol: (symbol: string) => void

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

  // Order Book Imbalance (OBI) State
  decayAlpha: number
  smoothingBeta: number
  smoothedImbalance: number
  imbalanceHistory: number[]
  updateObiSettings: (settings: Partial<{ decayAlpha: number; smoothingBeta: number }>) => void
  pushImbalanceValue: (val: number) => void
}

const LOCAL_STORAGE_KEY = 'quantstation:watchlist'

const DEFAULT_WATCHLIST: WatchlistTicker[] = [
  { symbol: 'SPY', prevClose: 520.50, atr: 4.80, rvol: 1.1, companyName: 'S&P 500 ETF' },
  { symbol: 'QQQ', prevClose: 440.20, atr: 5.50, rvol: 1.3, companyName: 'Nasdaq 100 ETF' },
  { symbol: 'AAPL', prevClose: 215.10, atr: 3.40, rvol: 0.9, companyName: 'Apple Inc.' },
  { symbol: 'NVDA', prevClose: 125.80, atr: 4.50, rvol: 2.2, companyName: 'NVIDIA Corp.' },
  { symbol: 'TSLA', prevClose: 180.20, atr: 6.20, rvol: 1.5, companyName: 'Tesla Inc.' },
  { symbol: 'MSFT', prevClose: 415.50, atr: 5.10, rvol: 0.8, companyName: 'Microsoft Corp.' },
  { symbol: 'AMZN', prevClose: 185.30, atr: 3.20, rvol: 1.2, companyName: 'Amazon.com Inc.' },
  { symbol: 'META', prevClose: 480.90, atr: 7.80, rvol: 1.4, companyName: 'Meta Platforms' },
]

const loadWatchlist = (): WatchlistTicker[] => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (e) {
    console.warn('[Zustand Store] Failed to load watchlist from localStorage:', e)
  }
  return DEFAULT_WATCHLIST
}

const getSeededSizeForStore = (symbol: string, isBid: boolean, levelIndex: number, l1Size?: number): number => {
  const seedString = `${symbol}-${isBid ? 'bid' : 'ask'}-${levelIndex}`
  let hash = 0
  for (let i = 0; i < seedString.length; i++) {
    hash = seedString.charCodeAt(i) + ((hash << 5) - hash)
  }
  const x = Math.sin(hash) * 10000
  const randomFraction = x - Math.floor(x)
  const baseSize = Math.floor(randomFraction * 400 + 50) // 50 to 450

  if (levelIndex === 0 && l1Size && l1Size > 0) {
    return l1Size
  }

  if (l1Size && l1Size > 0) {
    const l1BaseSeed = `${symbol}-${isBid ? 'bid' : 'ask'}-0`
    let l1Hash = 0
    for (let i = 0; i < l1BaseSeed.length; i++) {
      l1Hash = l1BaseSeed.charCodeAt(i) + ((l1Hash << 5) - l1Hash)
    }
    const l1X = Math.sin(l1Hash) * 10000
    const l1Base = Math.floor((l1X - Math.floor(l1X)) * 400 + 50)

    const ratio = l1Size / l1Base
    const clampedRatio = Math.max(0.5, Math.min(2.0, ratio))
    return Math.floor(baseSize * (0.8 + 0.2 * clampedRatio))
  }
  return baseSize
}

export const useStore = create<QuantStationState>((set) => ({
  // Connection
  connected: false,
  setConnected: (connected) => set({ connected }),
  ibkrConnected: false,
  setIbkrConnected: (ibkrConnected) => set({ ibkrConnected }),

  // Market data — keyed by symbol for O(1) lookups
  ticks: {},
  updateTick: (tick) =>
    set((state) => {
      const updatedOrders = state.orders.map((order) => {
        if (
          order.symbol === tick.symbol &&
          (order.status === 'SUBMITTED' || order.status === 'PARTIAL_FILL' || order.status === 'PENDING') &&
          (order.orderType === 'LIMIT' || order.orderType === 'STOP_LIMIT')
        ) {
          let q = order.estimatedQueuePosition
          if (q === undefined) {
            const basePrice = tick.price || tick.bidPrice || tick.askPrice || order.limitPrice
            const diffTicks = Math.round(Math.abs(order.limitPrice - basePrice) / 0.01)
            const isBid = order.side === 'BUY'
            const l1Size = isBid ? tick.bidSize : tick.askSize
            q = getSeededSizeForStore(order.symbol, isBid, diffTicks, l1Size)
          }

          if (tick.price === order.limitPrice && tick.size > 0) {
            q = Math.max(0, q - tick.size)
          }

          return { ...order, estimatedQueuePosition: q }
        }
        return order
      })

      return {
        ticks: { ...state.ticks, [tick.symbol]: tick },
        orders: updatedOrders,
      }
    }),

  // Watchlist
  watchlist: loadWatchlist(),
  addWatchlistSymbol: (symbol) =>
    set((state) => {
      const upper = symbol.toUpperCase().trim()
      if (!upper || state.watchlist.some((item) => item.symbol === upper)) return {}
      const newItem: WatchlistTicker = {
        symbol: upper,
        prevClose: 0.0,
        atr: 0.0,
        rvol: 1.0,
        companyName: `${upper} Corp.`,
      };
      const updated = [...state.watchlist, newItem]
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated))
      } catch (e) {
        console.warn('[Zustand Store] Failed to save watchlist to localStorage:', e)
      }
      return { watchlist: updated }
    }),
  removeWatchlistSymbol: (symbol) =>
    set((state) => {
      const updated = state.watchlist.filter((item) => item.symbol !== symbol.toUpperCase().trim())
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated))
      } catch (e) {
        console.warn('[Zustand Store] Failed to save watchlist to localStorage:', e)
      }
      return { watchlist: updated }
    }),

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

  // Order Book Imbalance (OBI) State
  decayAlpha: 0.8,
  smoothingBeta: 0.1,
  smoothedImbalance: 0.0,
  imbalanceHistory: [],
  updateObiSettings: (settings) => set((state) => ({ ...state, ...settings })),
  pushImbalanceValue: (val) => set((state) => {
    const history = [...state.imbalanceHistory, val].slice(-50); // limit to rolling 50 values
    return {
      imbalanceHistory: history,
      smoothedImbalance: state.smoothingBeta * val + (1 - state.smoothingBeta) * state.smoothedImbalance
    };
  }),
}))

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LOCAL_STORAGE_KEY) {
      try {
        const parsed = e.newValue ? JSON.parse(e.newValue) : null
        if (Array.isArray(parsed)) {
          useStore.setState({ watchlist: parsed })
        }
      } catch (err) {
        console.warn('[Zustand Store] Failed to sync watchlist from storage event:', err)
      }
    }
  })
}
