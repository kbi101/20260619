import React from 'react'
import type { MarketExposureData } from './types'

interface Props {
  exposure: MarketExposureData
}

/**
 * MarketExposure — Long/Short/Net/Gross/Beta-Adjusted exposure cards.
 */
export const MarketExposure: React.FC<Props> = ({ exposure }) => {
  const fmt = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
    return `$${v.toFixed(0)}`
  }

  const maxVal = Math.max(exposure.longExposure, exposure.shortExposure, 1)

  const items: { label: string; value: number; color: string; showBar: boolean }[] = [
    { label: 'Long Exposure', value: exposure.longExposure, color: 'var(--qs-green)', showBar: true },
    { label: 'Short Exposure', value: exposure.shortExposure, color: 'var(--qs-red)', showBar: true },
    { label: 'Net Exposure', value: exposure.netExposure, color: 'var(--qs-blue)', showBar: false },
    { label: 'Gross Exposure', value: exposure.grossExposure, color: 'var(--qs-text-primary)', showBar: false },
    { label: 'Beta-Adjusted', value: exposure.betaAdjustedExposure, color: 'var(--qs-amber)', showBar: false },
  ]

  return (
    <div className="pf-glass-card">
      <div className="pf-glass-card__title">Market Exposure</div>
      <div className="pf-exposure-list">
        {items.map(item => (
          <div key={item.label} className="pf-exposure-item">
            <div className="pf-exposure-item__header">
              <span className="pf-exposure-item__label">{item.label}</span>
              <span className="pf-exposure-item__value" style={{ color: item.color }}>{fmt(item.value)}</span>
            </div>
            {item.showBar && (
              <div className="pf-exposure-item__track">
                <div
                  className="pf-exposure-item__fill"
                  style={{
                    width: `${(item.value / maxVal) * 100}%`,
                    background: item.color,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
