import React from 'react'
import type { PerformanceAttributionData } from './types'

interface Props {
  attribution: PerformanceAttributionData
}

/**
 * PerformanceAttribution — 3-panel attribution: By Sector, By Strategy, By Model.
 */
export const PerformanceAttribution: React.FC<Props> = ({ attribution }) => {
  const fmtPnl = (v: number) => {
    const sign = v >= 0 ? '+' : ''
    return `${sign}$${Math.abs(v).toLocaleString()}`
  }

  const pnlColor = (v: number) =>
    v > 0 ? 'var(--qs-green)' : v < 0 ? 'var(--qs-red)' : 'var(--qs-text-muted)'

  const renderColumn = (title: string, items: { name: string; pnl: number }[]) => {
    const maxAbs = Math.max(...items.map(i => Math.abs(i.pnl)), 1)
    return (
      <div className="pf-attrib-col">
        <div className="pf-attrib-col__title">{title}</div>
        {items.map(item => (
          <div key={item.name} className="pf-attrib-row">
            <span className="pf-attrib-row__name">{item.name}</span>
            <div className="pf-attrib-row__bar-area">
              {item.pnl >= 0 ? (
                <div className="pf-attrib-row__bar-positive">
                  <div
                    className="pf-attrib-row__bar-fill"
                    style={{ width: `${(item.pnl / maxAbs) * 100}%`, background: 'var(--qs-green)' }}
                  />
                </div>
              ) : (
                <div className="pf-attrib-row__bar-negative">
                  <div
                    className="pf-attrib-row__bar-fill"
                    style={{ width: `${(Math.abs(item.pnl) / maxAbs) * 100}%`, background: 'var(--qs-red)' }}
                  />
                </div>
              )}
            </div>
            <span className="pf-attrib-row__value" style={{ color: pnlColor(item.pnl) }}>
              {fmtPnl(item.pnl)}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="pf-glass-card">
      <div className="pf-glass-card__title">Performance Attribution</div>
      <div className="pf-attrib-grid">
        {renderColumn('By Sector', attribution.bySector)}
        {renderColumn('By Strategy', attribution.byStrategy)}
        {renderColumn('By Model', attribution.byModel)}
      </div>
    </div>
  )
}
