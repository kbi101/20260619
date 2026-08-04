import React from 'react'
import type { StrategyAllocationItem } from './types'

interface Props {
  strategies: StrategyAllocationItem[]
}

/**
 * StrategyAllocation — Horizontal bar chart showing allocation by trading strategy.
 */
export const StrategyAllocation: React.FC<Props> = ({ strategies }) => {
  const maxPct = Math.max(...strategies.map(s => s.percentage), 1)

  return (
    <div className="pf-glass-card">
      <div className="pf-glass-card__title">Strategy Allocation</div>
      <div className="pf-bar-chart">
        {strategies.map(s => (
          <div key={s.strategy} className="pf-bar-item">
            <div className="pf-bar-item__header">
              <span className="pf-bar-item__name">{s.strategy}</span>
              <span className="pf-bar-item__pct">{s.percentage}%</span>
            </div>
            <div className="pf-bar-item__track">
              <div
                className="pf-bar-item__fill"
                style={{
                  width: `${(s.percentage / maxPct) * 100}%`,
                  background: s.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
