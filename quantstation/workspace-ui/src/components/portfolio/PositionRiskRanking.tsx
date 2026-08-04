import React from 'react'
import type { PositionRisk } from './types'

interface Props {
  risks: PositionRisk[]
}

/**
 * PositionRiskRanking — Ranked cards showing highest-risk positions.
 */
export const PositionRiskRanking: React.FC<Props> = ({ risks }) => {
  const severityColor = (s: string) => {
    if (s === 'critical') return 'var(--qs-red)'
    if (s === 'warning') return 'var(--qs-amber)'
    return 'var(--qs-text-secondary)'
  }

  return (
    <div className="pf-glass-card">
      <div className="pf-glass-card__title">Position Risk Ranking</div>
      <div className="pf-risk-ranking">
        {risks.map((r, i) => (
          <div key={r.symbol} className={`pf-risk-card pf-risk-card--${r.severity}`}>
            <div className="pf-risk-card__header">
              <span className="pf-risk-card__rank">#{i + 1}</span>
              <span className="pf-risk-card__symbol">{r.symbol}</span>
              <span className="pf-risk-card__score" style={{ color: severityColor(r.severity) }}>
                Risk {r.riskScore}
              </span>
            </div>
            <div className="pf-risk-card__reasons">
              {r.reasons.map((reason, j) => (
                <span key={j} className="pf-risk-card__reason">• {reason}</span>
              ))}
            </div>
            <div className="pf-risk-card__bar-track">
              <div
                className="pf-risk-card__bar-fill"
                style={{
                  width: `${r.riskScore}%`,
                  background: severityColor(r.severity),
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
