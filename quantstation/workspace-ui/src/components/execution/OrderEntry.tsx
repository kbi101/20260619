import React, { useState } from 'react'
import type { OrderSide, OrderType, OrderRequest } from '../../types/order'

/**
 * Quick-action order entry form.
 *
 * Sends orders to the Spring Boot REST API for OMS processing.
 */
export const OrderEntry: React.FC = () => {
  const [symbol, setSymbol] = useState('SPY')
  const [quantity, setQuantity] = useState(1)
  const [orderType, setOrderType] = useState<OrderType>('MARKET')
  const [limitPrice, setLimitPrice] = useState(0)

  const submitOrder = async (side: OrderSide) => {
    const request: OrderRequest = {
      symbol,
      side,
      orderType,
      quantity,
      limitPrice: orderType === 'LIMIT' ? limitPrice : 0,
      stopPrice: 0,
    }

    try {
      const res = await fetch('http://localhost:8080/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      if (!res.ok) {
        console.error('Order submission failed:', await res.text())
      }
    } catch (err) {
      console.error('Order submission error:', err)
    }
  }

  return (
    <div className="order-entry">
      <div className="order-entry__field">
        <label className="order-entry__label">Symbol</label>
        <input
          id="order-symbol"
          className="order-entry__input"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        />
      </div>

      <div className="order-entry__field">
        <label className="order-entry__label">Quantity</label>
        <input
          id="order-quantity"
          className="order-entry__input"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
      </div>

      <div className="order-entry__field">
        <label className="order-entry__label">Type</label>
        <select
          id="order-type"
          className="order-entry__input"
          value={orderType}
          onChange={(e) => setOrderType(e.target.value as OrderType)}
        >
          <option value="MARKET">Market</option>
          <option value="LIMIT">Limit</option>
          <option value="STOP">Stop</option>
          <option value="STOP_LIMIT">Stop Limit</option>
        </select>
      </div>

      {(orderType === 'LIMIT' || orderType === 'STOP_LIMIT') && (
        <div className="order-entry__field">
          <label className="order-entry__label">Limit Price</label>
          <input
            id="order-limit-price"
            className="order-entry__input"
            type="number"
            step={0.01}
            value={limitPrice}
            onChange={(e) => setLimitPrice(Number(e.target.value))}
          />
        </div>
      )}

      <div className="order-entry__actions">
        <button
          id="btn-buy"
          className="btn btn--buy"
          onClick={() => submitOrder('BUY')}
        >
          Buy
        </button>
        <button
          id="btn-sell"
          className="btn btn--sell"
          onClick={() => submitOrder('SELL')}
        >
          Sell
        </button>
      </div>
    </div>
  )
}
