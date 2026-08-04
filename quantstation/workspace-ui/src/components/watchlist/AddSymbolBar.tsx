import React, { useState } from 'react'
import { useStore } from '../../store/useStore'

export const AddSymbolBar: React.FC = () => {
  const { addManualSymbol } = useStore()
  const [symbol, setSymbol] = useState('')

  const handleAdd = () => {
    const trimmed = symbol.trim().toUpperCase()
    console.log(`[AddSymbolBar] handleAdd called with raw="${symbol}", trimmed="${trimmed}"`)
    if (trimmed) {
      addManualSymbol(trimmed)
      setSymbol('')
    }
  }

  return (
    <div className="wl-add-bar">
      <input
        type="text"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd()
        }}
        placeholder="Add ticker to watchlist (e.g. AMD, NVDA, TSLA)..."
        className="wl-add-bar__input"
      />
      <button onClick={handleAdd} className="wl-add-bar__btn">
        + Add Ticker
      </button>
    </div>
  )
}
