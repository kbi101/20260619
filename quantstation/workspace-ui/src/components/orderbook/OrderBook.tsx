import React, { useEffect, useRef, useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'

/**
 * Deterministic pseudo-random size generator seeded by symbol name, level index, and side.
 * Scales the baseline depth using Level 1 sizes to dynamically adjust depth.
 */
const getSeededSize = (symbol: string, isBid: boolean, levelIndex: number, l1Size?: number): number => {
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

/**
 * Real-time L2 Order Book rendering with advanced OBI Analytics and Spoofing detection.
 */
export const OrderBook: React.FC = () => {
  const {
    ticks,
    activeSymbol,
    watchlist,
    decayAlpha,
    smoothingBeta,
    smoothedImbalance,
    imbalanceHistory,
    updateObiSettings,
    pushImbalanceValue,
  } = useStore()

  const tick = ticks[activeSymbol]

  // Generate mock depth levels around the current price for visual demo
  const watchlistItem = watchlist.find((item) => item.symbol === activeSymbol)
  const fallbackPrice = watchlistItem && watchlistItem.prevClose > 0 ? watchlistItem.prevClose : 450.0
  const currentPrice = tick?.price ?? fallbackPrice
  const levels = 20

  const generateLevels = (basePrice: number) => {
    const bids: Array<{ price: number; size: number }> = []
    const asks: Array<{ price: number; size: number }> = []

    for (let i = 0; i < levels; i++) {
      bids.push({
        price: basePrice - (i + 1) * 0.01,
        size: getSeededSize(activeSymbol, true, i, tick?.bidSize),
      })
      asks.push({
        price: basePrice + (i + 1) * 0.01,
        size: getSeededSize(activeSymbol, false, i, tick?.askSize),
      })
    }
    return { bids, asks: asks.reverse() }
  }

  const { bids, asks } = generateLevels(currentPrice)

  // Calculations
  const rawBids = bids.reduce((acc, curr) => acc + curr.size, 0)
  const rawAsks = asks.reduce((acc, curr) => acc + curr.size, 0)

  const weightedBids = bids.reduce((acc, curr, idx) => acc + curr.size * Math.pow(decayAlpha, idx), 0)
  const weightedAsks = asks.reduce((acc, curr, idx) => {
    const levelIdx = asks.length - 1 - idx
    return acc + curr.size * Math.pow(decayAlpha, levelIdx)
  }, 0)

  const maxSize = Math.max(
    ...bids.map((b) => b.size),
    ...asks.map((a) => a.size)
  )

  const totalRaw = rawBids + rawAsks
  const askPct = totalRaw > 0 ? (rawAsks / totalRaw) * 100 : 50
  const bidPct = totalRaw > 0 ? (rawBids / totalRaw) * 100 : 50
  const needlePos = Math.max(0, Math.min(100, ((smoothedImbalance + 1) / 2) * 100))

  // Trigger calculation updates when tick changes
  const tickKey = tick ? `${tick.symbol}-${tick.price}-${tick.bidSize}-${tick.askSize}-${tick.timestamp}` : ''
  const prevTickKeyRef = useRef<string>('')

  // Iceberg detection state and tracking
  const prevL1Ref = useRef<{ bidSize: number; bidPrice: number; askSize: number; askPrice: number }>({
    bidSize: 0,
    bidPrice: 0,
    askSize: 0,
    askPrice: 0,
  })
  const [icebergAlert, setIcebergAlert] = useState<{ side: 'BUY' | 'SELL'; size: number; price: number } | null>(null)

  useEffect(() => {
    if (tick && tickKey !== prevTickKeyRef.current) {
      prevTickKeyRef.current = tickKey

      // Re-calculate weighted volumes exactly as on render
      let wBids = 0
      let wAsks = 0

      for (let i = 0; i < levels; i++) {
        const bidSize = getSeededSize(activeSymbol, true, i, tick.bidSize)
        const askSize = getSeededSize(activeSymbol, false, i, tick.askSize)
        wBids += bidSize * Math.pow(decayAlpha, i)
        wAsks += askSize * Math.pow(decayAlpha, i)
      }

      const denom = wBids + wAsks
      const rawImbalance = denom > 0 ? (wBids - wAsks) / denom : 0
      pushImbalanceValue(rawImbalance)

      // Iceberg/hidden volume check
      const prev = prevL1Ref.current
      if (tick.size > 0 && tick.price > 0 && prev.bidPrice > 0 && prev.askPrice > 0) {
        let hiddenVolume = 0
        let side: 'BUY' | 'SELL' | null = null

        if (tick.price === prev.bidPrice) {
          const depletion = prev.bidSize - tick.bidSize
          hiddenVolume = Math.max(0, tick.size - depletion)
          if (hiddenVolume > 0) side = 'BUY'
        } else if (tick.price === prev.askPrice) {
          const depletion = prev.askSize - tick.askSize
          hiddenVolume = Math.max(0, tick.size - depletion)
          if (hiddenVolume > 0) side = 'SELL'
        }

        if (side && hiddenVolume > 100) {
          setIcebergAlert({
            side,
            size: hiddenVolume,
            price: tick.price,
          })
        }
      }

      // Update prev L1 cache
      prevL1Ref.current = {
        bidSize: tick.bidSize,
        bidPrice: tick.bidPrice,
        askSize: tick.askSize,
        askPrice: tick.askPrice,
      }
    }
  }, [tick, tickKey, activeSymbol, decayAlpha, pushImbalanceValue])

  // Clear iceberg alert after 3 seconds
  useEffect(() => {
    if (icebergAlert) {
      const timer = setTimeout(() => setIcebergAlert(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [icebergAlert])

  // Volatility metric calculations
  const stdDev = useMemo(() => {
    if (imbalanceHistory.length === 0) return 0
    const mean = imbalanceHistory.reduce((a, b) => a + b, 0) / imbalanceHistory.length
    const variance = imbalanceHistory.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / imbalanceHistory.length
    return Math.sqrt(variance)
  }, [imbalanceHistory])

  const volatilityStatus = useMemo(() => {
    if (stdDev < 0.15) return 'stable'
    if (stdDev < 0.35) return 'transition'
    return 'unstable'
  }, [stdDev])

  return (
    <div className="orderbook">
      {/* Scrollable L2 Levels */}
      <div className="orderbook__rows" style={{ flex: 1, overflowY: 'auto' }}>
        {/* Asks (sells) — displayed top to bottom, highest to lowest */}
        {asks.map((level, i) => (
          <div key={`ask-${i}`} className="orderbook__row" style={{ position: 'relative' }}>
            <div
              className="orderbook__depth orderbook__depth--ask"
              style={{ width: `${(level.size / (maxSize || 1)) * 50}%` }}
            />
            <span className="orderbook__bid" />
            <span className="orderbook__price">{level.price.toFixed(2)}</span>
            <span className="orderbook__ask">{level.size}</span>
          </div>
        ))}

        {/* Spread */}
        <div
          className="orderbook__row"
          style={{
            background: 'var(--qs-bg-tertiary)',
            justifyContent: 'center',
            padding: 'var(--qs-gap-xs) var(--qs-gap-sm)',
            borderTop: '1px solid var(--qs-border)',
            borderBottom: '1px solid var(--qs-border)',
          }}
        >
          <span
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              color: 'var(--qs-text-muted)',
              fontSize: 'var(--qs-font-xs)',
            }}
          >
            Spread: {(asks[asks.length - 1]?.price - bids[0]?.price).toFixed(2)} · Mid: {currentPrice.toFixed(2)}
          </span>
        </div>

        {/* Bids (buys) */}
        {bids.map((level, i) => (
          <div key={`bid-${i}`} className="orderbook__row" style={{ position: 'relative' }}>
            <div
              className="orderbook__depth orderbook__depth--bid"
              style={{ width: `${(level.size / (maxSize || 1)) * 50}%` }}
            />
            <span className="orderbook__bid">{level.size}</span>
            <span className="orderbook__price">{level.price.toFixed(2)}</span>
            <span className="orderbook__ask" />
          </div>
        ))}
      </div>

      {/* Dynamic Iceberg Alert Badge */}
      {icebergAlert && (
        <div
          style={{
            margin: '0 var(--qs-gap-sm) var(--qs-gap-xs) var(--qs-gap-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            background: icebergAlert.side === 'BUY' ? 'rgba(38, 166, 154, 0.15)' : 'rgba(239, 83, 80, 0.15)',
            border: `1px solid ${icebergAlert.side === 'BUY' ? 'var(--qs-green)' : 'var(--qs-red)'}`,
            padding: '4px var(--qs-gap-sm)',
            borderRadius: 'var(--qs-radius-sm)',
            fontSize: '10px',
            color: icebergAlert.side === 'BUY' ? 'var(--qs-green)' : 'var(--qs-red)',
            fontWeight: 600,
          }}
        >
          <span>⚠️ ICEBERG: {icebergAlert.side} {icebergAlert.size.toLocaleString()} sh @ {icebergAlert.price.toFixed(2)}</span>
        </div>
      )}

      {/* OBI Analytics Panel */}
      <div className="orderbook__analytics">
        <div className="obi-title">
          <span>Order Book Imbalance</span>
          <div className="obi-status-container">
            <span className={`pulse-dot pulse-dot--${volatilityStatus}`} />
            <span>{volatilityStatus.toUpperCase()} (σ: {stdDev.toFixed(2)})</span>
          </div>
        </div>

        <div className="obi-meter">
          <div className="obi-meter__fill-ask" style={{ width: `${askPct}%` }} />
          <div className="obi-meter__fill-bid" style={{ width: `${bidPct}%` }} />
          <div className="obi-meter__needle" style={{ left: `${needlePos}%` }} />
        </div>

        <div className="obi-stats">
          <div className="obi-stat__col">
            <span className="obi-stat__label">Raw Vol (Ask/Bid)</span>
            <span className="obi-stat__value">
              {rawAsks.toLocaleString()} / {rawBids.toLocaleString()}
            </span>
          </div>
          <div className="obi-stat__col" style={{ textAlign: 'right' }}>
            <span className="obi-stat__label">Weighted Vol (Ask/Bid)</span>
            <span className="obi-stat__value">
              {Math.round(weightedAsks).toLocaleString()} / {Math.round(weightedBids).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="obi-stats">
          <div className="obi-stat__col">
            <span className="obi-stat__label">Smoothed OBI</span>
            <span
              className="obi-stat__value"
              style={{
                color: smoothedImbalance > 0.05 ? 'var(--qs-green)' : smoothedImbalance < -0.05 ? 'var(--qs-red)' : 'var(--qs-text-primary)',
              }}
            >
              {smoothedImbalance > 0 ? '+' : ''}
              {smoothedImbalance.toFixed(2)}
            </span>
          </div>
          <div className="obi-stat__col" style={{ textAlign: 'right' }}>
            <span className="obi-stat__label">Persistence</span>
            <span
              className="obi-stat__value"
              style={{
                color: volatilityStatus === 'stable' ? 'var(--qs-green)' : volatilityStatus === 'transition' ? 'var(--qs-amber)' : 'var(--qs-red)',
              }}
            >
              {volatilityStatus === 'stable' ? 'STABLE' : volatilityStatus === 'transition' ? 'NORMAL' : 'ALERT'}
            </span>
          </div>
        </div>

        <div className="obi-settings">
          <div className="obi-settings__field">
            <span className="obi-settings__label">Decay (α)</span>
            <div className="obi-settings__slider-container">
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={decayAlpha}
                onChange={(e) => updateObiSettings({ decayAlpha: parseFloat(e.target.value) })}
                className="obi-settings__slider"
              />
              <span className="obi-settings__value">{decayAlpha.toFixed(2)}</span>
            </div>
          </div>
          <div className="obi-settings__field">
            <span className="obi-settings__label">Smoothing (β)</span>
            <div className="obi-settings__slider-container">
              <input
                type="range"
                min="0.01"
                max="0.5"
                step="0.01"
                value={smoothingBeta}
                onChange={(e) => updateObiSettings({ smoothingBeta: parseFloat(e.target.value) })}
                className="obi-settings__slider"
              />
              <span className="obi-settings__value">{smoothingBeta.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Inactive Overlay */}
      <div className="orderbook__overlay">
        <div className="orderbook__overlay-content">
          <span className="orderbook__overlay-icon">🔒</span>
          <h3 className="orderbook__overlay-title">Level 2 Offline</h3>
          <p className="orderbook__overlay-desc">
            Live Level 2 market depth data requires an active IBKR subscription. Simulated data is disabled.
          </p>
          <span className="orderbook__overlay-badge">Inactive</span>
        </div>
      </div>
    </div>
  )
}
