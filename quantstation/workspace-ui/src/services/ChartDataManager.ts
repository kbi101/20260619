// ═══════════════════════════════════════════════════════
// QuantStation — Chart Data Manager Service
// ═══════════════════════════════════════════════════════
// Manages OHLCV bars cache, buffers streaming ticks during API fetches,
// and publishes tick-by-tick updates directly to chart components.

import type { Tick } from '../types/market'

export interface ChartBar {
  time: number; // Unix timestamp in seconds (local offset adjusted)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ChartStatus = 'idle' | 'loading' | 'success' | 'error'

interface ChartCacheEntry {
  bars: ChartBar[]
  tickBuffer: Tick[]
  status: ChartStatus
}

// Global cache defined in module scope to survive component lifecycle/unmounts
const cache: Record<string, ChartCacheEntry> = {}

type TickListener = (tick: Tick, updatedBar: ChartBar, isNewBar: boolean) => void
const listeners: Record<string, Set<TickListener>> = {}

function getOrCreateEntry(symbol: string): ChartCacheEntry {
  if (!cache[symbol]) {
    cache[symbol] = {
      bars: [],
      tickBuffer: [],
      status: 'idle',
    }
  }
  return cache[symbol]
}

function getRoundedTimeForTick(tick: Tick): number {
  const tickTimeMs = new Date(tick.timestamp).getTime()
  const offsetMinutes = new Date().getTimezoneOffset()
  const offsetSeconds = offsetMinutes * 60
  const time = Math.floor(tickTimeMs / 1000) - offsetSeconds
  return Math.floor(time / 60) * 60
}

/**
 * Returns the cached bars list for a symbol.
 */
export function getChartBars(symbol: string): ChartBar[] {
  return getOrCreateEntry(symbol).bars
}

/**
 * Returns the status of the chart cache for a symbol.
 */
export function getChartStatus(symbol: string): ChartStatus {
  return getOrCreateEntry(symbol).status
}

/**
 * Explicitly sets the loading/idle/error status for a symbol.
 */
export function setChartStatus(symbol: string, status: ChartStatus): void {
  const entry = getOrCreateEntry(symbol)
  entry.status = status
  if (status === 'loading') {
    entry.tickBuffer = []
  }
}

/**
 * Sets the historical bars as the base data, then replays and merges
 * any ticks buffered while the historical fetch was pending.
 */
export function initChartBars(symbol: string, historicalBars: ChartBar[]): void {
  const entry = getOrCreateEntry(symbol)
  entry.bars = [...historicalBars]
  entry.status = 'success'

  const buffer = entry.tickBuffer
  entry.tickBuffer = []

  console.log(`[ChartDataManager] Initializing ${symbol} with ${historicalBars.length} bars and replaying ${buffer.length} buffered ticks`)

  buffer.forEach((tick) => {
    const roundedTime = getRoundedTimeForTick(tick)
    if (entry.bars.length === 0) {
      entry.bars.push({
        time: roundedTime,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.size,
      })
    } else {
      const lastBar = entry.bars[entry.bars.length - 1]
      if (roundedTime < lastBar.time) {
        // Discard ticks older than historical data
      } else if (roundedTime === lastBar.time) {
        lastBar.high = Math.max(lastBar.high, tick.price)
        lastBar.low = Math.min(lastBar.low, tick.price)
        lastBar.close = tick.price
        lastBar.volume += tick.size
      } else {
        entry.bars.push({
          time: roundedTime,
          open: tick.price,
          high: tick.price,
          low: tick.price,
          close: tick.price,
          volume: tick.size,
        })
      }
    }
  })
}

/**
 * Processes incoming WebSocket ticks.
 * If status is 'loading', the tick is buffered.
 * If status is 'success', it updates the active bars and notifies listeners.
 */
export function processIncomingTick(tick: Tick): void {
  const symbol = tick.symbol
  const entry = getOrCreateEntry(symbol)

  if (entry.status === 'loading') {
    entry.tickBuffer.push(tick)
    return
  }

  if (entry.status !== 'success') {
    // If not actively listening or loading, ignore tick to save memory
    return
  }

  const roundedTime = getRoundedTimeForTick(tick)
  let isNewBar = false
  let targetBar: ChartBar

  if (entry.bars.length === 0) {
    targetBar = {
      time: roundedTime,
      open: tick.price,
      high: tick.price,
      low: tick.price,
      close: tick.price,
      volume: tick.size,
    }
    entry.bars.push(targetBar)
    isNewBar = true
  } else {
    const lastBar = entry.bars[entry.bars.length - 1]
    if (roundedTime < lastBar.time) {
      // Ignore out-of-order ticks older than the current bar to prevent chart issues
      return
    } else if (roundedTime === lastBar.time) {
      lastBar.high = Math.max(lastBar.high, tick.price)
      lastBar.low = Math.min(lastBar.low, tick.price)
      lastBar.close = tick.price
      lastBar.volume += tick.size
      targetBar = lastBar
    } else {
      targetBar = {
        time: roundedTime,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.size,
      }
      entry.bars.push(targetBar)
      isNewBar = true
    }
  }

  // Notify listeners
  if (listeners[symbol]) {
    listeners[symbol].forEach((callback) => {
      try {
        callback(tick, targetBar, isNewBar)
      } catch (err) {
        console.error(`[ChartDataManager] Error in listener for ${symbol}:`, err)
      }
    })
  }
}

/**
 * Subscribes to tick updates for a symbol.
 * Returns an unsubscribe cleanup function.
 */
export function registerChartTickListener(symbol: string, callback: TickListener): () => void {
  if (!listeners[symbol]) {
    listeners[symbol] = new Set()
  }
  listeners[symbol].add(callback)

  return () => {
    if (listeners[symbol]) {
      listeners[symbol].delete(callback)
      if (listeners[symbol].size === 0) {
        delete listeners[symbol]
      }
    }
  }
}
