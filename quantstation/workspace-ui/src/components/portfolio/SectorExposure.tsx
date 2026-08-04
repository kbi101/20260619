import React from 'react'
import type { SectorExposureItem } from './types'

interface Props {
  sectors: SectorExposureItem[]
}

/**
 * SectorExposure — CSS conic-gradient donut chart with legend.
 */
export const SectorExposure: React.FC<Props> = ({ sectors }) => {
  // Build conic-gradient stops
  let cumulativePct = 0
  const gradientStops = sectors.map(s => {
    const start = cumulativePct
    cumulativePct += s.percentage
    return `${s.color} ${start}% ${cumulativePct}%`
  }).join(', ')

  const conicGradient = `conic-gradient(from 0deg, ${gradientStops})`

  return (
    <div className="pf-glass-card">
      <div className="pf-glass-card__title">Sector Exposure</div>
      <div className="pf-donut-layout">
        <div className="pf-donut" style={{ background: conicGradient }}>
          <div className="pf-donut__hole" />
        </div>
        <div className="pf-donut-legend">
          {sectors.map(s => (
            <div key={s.sector} className="pf-donut-legend__item">
              <span className="pf-donut-legend__swatch" style={{ background: s.color }} />
              <span className="pf-donut-legend__name">{s.sector}</span>
              <span className="pf-donut-legend__pct">{s.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
