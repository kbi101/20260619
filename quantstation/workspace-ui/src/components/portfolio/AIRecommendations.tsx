import React from 'react'
import type { AIRecommendation } from './types'

interface Props {
  recommendations: AIRecommendation[]
}

/**
 * AIRecommendations — Actionable insight cards with priority indicators.
 */
export const AIRecommendations: React.FC<Props> = ({ recommendations }) => {
  const priorityColor = (p: string) => {
    if (p === 'high') return 'var(--qs-red)'
    if (p === 'medium') return 'var(--qs-amber)'
    return 'var(--qs-text-secondary)'
  }

  const priorityLabel = (p: string) => {
    if (p === 'high') return 'HIGH'
    if (p === 'medium') return 'MED'
    return 'LOW'
  }

  return (
    <div className="pf-glass-card">
      <div className="pf-glass-card__title">
        AI Recommendations
        <span className="pf-glass-card__badge">{recommendations.filter(r => !r.completed).length}</span>
      </div>
      <div className="pf-recommendations-list">
        {recommendations.map(rec => (
          <div key={rec.id} className={`pf-recommendation ${rec.completed ? 'pf-recommendation--done' : ''}`}>
            <span className="pf-recommendation__check">{rec.completed ? '✓' : '○'}</span>
            <span className="pf-recommendation__text">{rec.text}</span>
            <span
              className="pf-recommendation__priority"
              style={{ color: priorityColor(rec.priority), borderColor: priorityColor(rec.priority) }}
            >
              {priorityLabel(rec.priority)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
