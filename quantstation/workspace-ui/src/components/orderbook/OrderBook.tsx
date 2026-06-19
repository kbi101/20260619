import React from 'react'
import { useStore } from '../../store/useStore'

/**
 * Real-time L2 Order Book rendering.
 *
 * Displays bid/ask depth with visual depth bars and
 * price flash animations on tick updates.
 */
export const OrderBook: React.FC = () => {
  const { ticks, activeSymbol } = useStore()
  const tick = ticks[activeSymbol]

  // Generate mock depth levels around the current price for visual demo
  const currentPrice = tick?.price ?? 450.0
  const levels = 20

  const generateLevels = (basePrice: number) => {
    const bids: Array<{ price: number; size: number }> = []
    const asks: Array<{ price: number; size: number }> = []

    for (let i = 0; i < levels; i++) {
      bids.push({
        price: basePrice - (i + 1) * 0.01,
        size: Math.floor(Math.random() * 500 + 50),
      })
      asks.push({
        price: basePrice + (i + 1) * 0.01,
        size: Math.floor(Math.random() * 500 + 50),
      })
    }
    return { bids, asks: asks.reverse() }
  }

  const { bids, asks } = generateLevels(currentPrice)
  const maxSize = Math.max(
    ...bids.map((b) => b.size),
    ...asks.map((a) => a.size)
  )

  return (
    <div className="orderbook">
      {/* Asks (sells) — displayed top to bottom, highest to lowest */}
      {asks.map((level, i) => (
        <div key={`ask-${i}`} className="orderbook__row" style={{ position: 'relative' }}>
          <div
            className="orderbook__depth orderbook__depth--ask"
            style={{ width: `${(level.size / maxSize) * 50}%` }}
          />
          <span className="orderbook__bid" />
          <span className="orderbook__price">{level.price.toFixed(2)}</span>
          <span className="orderbook__ask">{level.size}</span>
        </div>
      ))}

      {/* Spread */}
      <div className="orderbook__row" style={{
        background: 'var(--qs-bg-tertiary)',
        justifyContent: 'center',
        padding: 'var(--qs-gap-xs) var(--qs-gap-sm)',
      }}>
        <span style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--qs-text-muted)', fontSize: 'var(--qs-font-xs)' }}>
          Spread: {(asks[asks.length - 1]?.price - bids[0]?.price).toFixed(2)} ·
          Mid: {currentPrice.toFixed(2)}
        </span>
      </div>

      {/* Bids (buys) */}
      {bids.map((level, i) => (
        <div key={`bid-${i}`} className="orderbook__row" style={{ position: 'relative' }}>
          <div
            className="orderbook__depth orderbook__depth--bid"
            style={{ width: `${(level.size / maxSize) * 50}%` }}
          />
          <span className="orderbook__bid">{level.size}</span>
          <span className="orderbook__price">{level.price.toFixed(2)}</span>
          <span className="orderbook__ask" />
        </div>
      ))}
    </div>
  )
}
