import React from 'react'
import type { PortfolioOrder } from './types'

interface Props {
  orders: PortfolioOrder[]
}

/**
 * OpenOrders — Filtered view of pending/stop/limit/trailing orders.
 */
export const OpenOrders: React.FC<Props> = ({ orders }) => {
  const fmtTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    } catch { return '--:--' }
  }

  const sideClass = (side: string) => side === 'BUY' ? 'pf-side--buy' : 'pf-side--sell'

  const typeLabel = (t: string) => {
    switch (t) {
      case 'LIMIT': return 'LMT'
      case 'STOP': return 'STP'
      case 'STOP_LIMIT': return 'STP-LMT'
      case 'TRAILING': return 'TRAIL'
      case 'BRACKET': return 'BRKT'
      case 'MARKET': return 'MKT'
      default: return t
    }
  }

  return (
    <div className="pf-glass-card">
      <div className="pf-glass-card__title">
        Open Orders
        <span className="pf-glass-card__badge">{orders.length}</span>
      </div>
      {orders.length === 0 ? (
        <div className="pf-empty">No open orders</div>
      ) : (
        <table className="pf-orders-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Side</th>
              <th>Type</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.orderId}>
                <td className="pf-orders-table__symbol">{o.symbol}</td>
                <td className={sideClass(o.side)}>{o.side}</td>
                <td>{typeLabel(o.orderType)}</td>
                <td>{o.quantity.toLocaleString()}</td>
                <td>${o.price.toFixed(2)}</td>
                <td><span className={`pf-order-status pf-order-status--${o.status.toLowerCase()}`}>{o.status}</span></td>
                <td className="pf-pos--muted">{fmtTime(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
