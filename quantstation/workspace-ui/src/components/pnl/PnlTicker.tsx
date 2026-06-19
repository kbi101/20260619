import React from 'react'
import { useStore } from '../../store/useStore'

/**
 * Real-time PnL ticker showing unrealized, realized, and total PnL.
 */
export const PnlTicker: React.FC = () => {
  const { pnl, positions } = useStore()

  const formatPnl = (value: number): string => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}$${value.toFixed(2)}`
  }

  const pnlClass = (value: number): string => {
    if (value > 0) return 'pnl pnl--positive'
    if (value < 0) return 'pnl pnl--negative'
    return 'pnl pnl--zero'
  }

  const positionList = Object.values(positions)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--qs-gap-sm)', padding: 'var(--qs-gap-sm)' }}>
      {/* PnL Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--qs-gap-sm)' }}>
        <div className="pnl-card">
          <span className="pnl-card__label">Unrealized</span>
          <span className={`pnl-card__value ${pnlClass(pnl.unrealizedPnl)}`}>
            {formatPnl(pnl.unrealizedPnl)}
          </span>
        </div>
        <div className="pnl-card">
          <span className="pnl-card__label">Realized</span>
          <span className={`pnl-card__value ${pnlClass(pnl.realizedPnl)}`}>
            {formatPnl(pnl.realizedPnl)}
          </span>
        </div>
        <div className="pnl-card">
          <span className="pnl-card__label">Total</span>
          <span className={`pnl-card__value ${pnlClass(pnl.totalPnl)}`}>
            {formatPnl(pnl.totalPnl)}
          </span>
        </div>
      </div>

      {/* Positions */}
      {positionList.length > 0 && (
        <table className="blotter" style={{ marginTop: 'var(--qs-gap-sm)' }}>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Qty</th>
              <th>Avg Cost</th>
              <th>Mkt</th>
              <th>P&L</th>
            </tr>
          </thead>
          <tbody>
            {positionList.map((pos) => (
              <tr key={pos.symbol}>
                <td style={{ fontWeight: 600 }}>{pos.symbol}</td>
                <td className={pos.quantity > 0 ? 'price--up' : 'price--down'}>
                  {pos.quantity}
                </td>
                <td>{pos.avgCost.toFixed(2)}</td>
                <td>{pos.marketPrice.toFixed(2)}</td>
                <td className={pnlClass(pos.unrealizedPnl)}>
                  {formatPnl(pos.unrealizedPnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
