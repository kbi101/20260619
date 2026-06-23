// ═══════════════════════════════════════════════════════
// QuantStation — Market Data Types
// ═══════════════════════════════════════════════════════
// Matches Spring Boot domain models exactly

export interface Tick {
  symbol: string
  price: number
  size: number
  exchange: string | null
  conditions: string | null
  bidPrice: number
  askPrice: number
  bidSize: number
  askSize: number
  prevClose: number
  timestamp: string
}

export interface BarData {
  symbol: string
  timeframe: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  vwap: number
  tradeCount: number
  barStart: string
  barEnd: string
  timestamp: string
}

export interface OptionGreeks {
  contractSymbol: string
  underlying: string
  strike: number
  expiry: string
  callPut: 'C' | 'P'
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
  iv: number
  bid: number
  ask: number
  last: number
  volume: number
  openInterest: number
  timestamp: string
}

export interface OrderBookLevel {
  price: number
  size: number
  count: number
}

export interface OrderBookSnapshot {
  symbol: string
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  timestamp: string
}
