import React from 'react'
import { useStore } from '../../store/useStore'
import type { OrderStatus } from '../../types/order'

/**
 * Live order blotter — displays all active and recent orders.
 */
export const OrderBlotter: React.FC = () => {
  const { orders } = useStore()

  const statusBadge = (status: OrderStatus) => {
    const cls = `badge badge--${status.toLowerCase().replace('_', '-')}`
    return <span className={cls}>{status}</span>
  }

  const cancelOrder = async (orderId: string) => {
    try {
      await fetch(`http://localhost:8080/api/orders/${orderId}`, {
        method: 'DELETE',
      })
    } catch (err) {
      console.error('Cancel error:', err)
    }
  }

  return (
    <table className="blotter">
      <thead>
        <tr>
          <th>Time</th>
          <th>Symbol</th>
          <th>Side</th>
          <th>Type</th>
          <th>Qty</th>
          <th>Limit</th>
          <th>Queue Pos</th>
          <th>Filled</th>
          <th>Avg Price</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {orders.length === 0 && (
          <tr>
            <td colSpan={11} style={{
              textAlign: 'center',
              color: 'var(--qs-text-muted)',
              padding: 'var(--qs-gap-xl)',
            }}>
              No orders yet
            </td>
          </tr>
        )}
        {orders.map((order) => (
          <tr key={order.orderId}>
            <td>{new Date(order.createdAt).toLocaleTimeString()}</td>
            <td style={{ fontWeight: 600 }}>{order.symbol}</td>
            <td className={order.side === 'BUY' ? 'price--up' : 'price--down'}>
              {order.side}
            </td>
            <td>{order.orderType}</td>
            <td>{order.quantity}</td>
            <td>{order.limitPrice > 0 ? order.limitPrice.toFixed(2) : '—'}</td>
            <td>
              {order.orderType === 'LIMIT' || order.orderType === 'STOP_LIMIT' ? (
                order.estimatedQueuePosition !== undefined ? (
                  <span style={{ fontWeight: 500, color: 'var(--qs-text-primary)' }}>
                    {order.estimatedQueuePosition.toLocaleString()} sh
                  </span>
                ) : (
                  <span style={{ color: 'var(--qs-text-muted)' }}>Calculating...</span>
                )
              ) : (
                <span style={{ color: 'var(--qs-text-muted)' }}>—</span>
              )}
            </td>
            <td>{order.filledQuantity}/{order.quantity}</td>
            <td>{order.avgFillPrice > 0 ? order.avgFillPrice.toFixed(2) : '—'}</td>
            <td>{statusBadge(order.status)}</td>
            <td>
              {!['FILLED', 'CANCELLED', 'REJECTED'].includes(order.status) && (
                <button
                  className="btn btn--cancel"
                  style={{ padding: '2px 8px', fontSize: 'var(--qs-font-xs)' }}
                  onClick={() => cancelOrder(order.orderId)}
                >
                  Cancel
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
