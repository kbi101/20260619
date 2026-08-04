import React from 'react'
import type { TimelineEvent } from './types'

interface Props {
  events: TimelineEvent[]
}

/**
 * ActivityTimeline — Chronological trade activity log with time markers.
 */
export const ActivityTimeline: React.FC<Props> = ({ events }) => {
  const typeColor = (t: string) => {
    switch (t) {
      case 'trade': return 'var(--qs-blue)'
      case 'alert': return 'var(--qs-amber)'
      case 'update': return 'var(--qs-text-secondary)'
      case 'milestone': return 'var(--qs-gold)'
      default: return 'var(--qs-text-muted)'
    }
  }

  const typeIcon = (t: string) => {
    switch (t) {
      case 'trade': return '⬤'
      case 'alert': return '▲'
      case 'update': return '◆'
      case 'milestone': return '★'
      default: return '●'
    }
  }

  return (
    <div className="pf-glass-card">
      <div className="pf-glass-card__title">Activity Timeline</div>
      <div className="pf-timeline">
        {events.map(event => (
          <div key={event.id} className="pf-timeline-item">
            <div className="pf-timeline-item__marker" style={{ color: typeColor(event.type) }}>
              <span className="pf-timeline-item__icon">{typeIcon(event.type)}</span>
              <div className="pf-timeline-item__line" />
            </div>
            <div className="pf-timeline-item__content">
              <span className="pf-timeline-item__time">{event.time}</span>
              <span className="pf-timeline-item__message">{event.message}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
