import React from 'react'
import type { PortfolioAlert } from './types'

interface Props {
  alerts: PortfolioAlert[]
}

/**
 * AlertsFeed — Real-time alert feed with severity icons and timestamps.
 */
export const AlertsFeed: React.FC<Props> = ({ alerts }) => {
  const severityIcon = (s: string) => {
    switch (s) {
      case 'critical': return '🔴'
      case 'warning': return '🟡'
      case 'info': return '🔵'
      default: return '⚪'
    }
  }

  const fmtTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    } catch { return '--:--' }
  }

  return (
    <div className="pf-glass-card">
      <div className="pf-glass-card__title">
        Alerts
        <span className="pf-glass-card__badge pf-glass-card__badge--critical">
          {alerts.filter(a => a.severity === 'critical').length}
        </span>
      </div>
      <div className="pf-alerts-list">
        {alerts.map(alert => (
          <div key={alert.id} className={`pf-alert-item pf-alert-item--${alert.severity}`}>
            <span className="pf-alert-item__icon">{severityIcon(alert.severity)}</span>
            <div className="pf-alert-item__content">
              <span className="pf-alert-item__message">{alert.message}</span>
              <span className="pf-alert-item__time">{fmtTime(alert.timestamp)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
