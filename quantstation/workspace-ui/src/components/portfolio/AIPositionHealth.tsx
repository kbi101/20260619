import React from 'react'
import type { AIHealthItem } from './types'

interface Props {
  health: AIHealthItem[]
}

/**
 * AIPositionHealth — Per-position health cards with star ratings and trend indicators.
 */
export const AIPositionHealth: React.FC<Props> = ({ health }) => {
  const stateColor = (state: string) => {
    switch (state) {
      case 'Strong Buy': return 'var(--qs-green)'
      case 'Healthy': return 'var(--qs-green)'
      case 'Recovering': return 'var(--qs-blue)'
      case 'Weakening': return 'var(--qs-amber)'
      case 'Reduce': return 'var(--qs-amber)'
      case 'Breaking Down': return 'var(--qs-red)'
      case 'Exit': return 'var(--qs-red)'
      default: return 'var(--qs-text-secondary)'
    }
  }

  const dirArrow = (dir: string) => {
    if (dir === 'up') return '↑'
    if (dir === 'down') return '↓'
    return '→'
  }

  const renderStars = (count: number) => {
    const filled = '★'.repeat(count)
    const empty = '☆'.repeat(5 - count)
    return (
      <span className="pf-health-stars">
        <span className="pf-health-stars--filled">{filled}</span>
        <span className="pf-health-stars--empty">{empty}</span>
      </span>
    )
  }

  return (
    <div className="pf-glass-card">
      <div className="pf-glass-card__title">AI Position Health</div>
      <div className="pf-health-list">
        {health.map(h => (
          <div key={h.symbol} className="pf-health-card">
            <div className="pf-health-card__top">
              <span className="pf-health-card__symbol">{h.symbol}</span>
              {renderStars(h.stars)}
            </div>
            <div className="pf-health-card__bottom">
              <span className="pf-health-card__state" style={{ color: stateColor(h.state) }}>
                {h.state}
              </span>
              <span className="pf-health-card__trend">
                {h.trend}
                <span className={`pf-health-card__arrow pf-health-card__arrow--${h.momentumDirection}`}>
                  {dirArrow(h.momentumDirection)}
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
