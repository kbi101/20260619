import React, { useState } from 'react'
import { useStore } from '../../store/useStore'

export const WatchlistPanel: React.FC = () => {
  const { watchlist, addWatchlistSymbol, removeWatchlistSymbol, ticks } = useStore()
  const [newSymbol, setNewSymbol] = useState('')

  const handleRowClick = (symbol: string) => {
    console.log(`[WatchlistPanel] Selected symbol: ${symbol}. Triggering IPC...`)
    if (window.electronAPI?.selectSymbol) {
      window.electronAPI.selectSymbol(symbol)
    }
  }

  const handleAdd = () => {
    const symbol = newSymbol.trim().toUpperCase()
    if (symbol) {
      addWatchlistSymbol(symbol)
      setNewSymbol('')
    }
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
    }}>
      {/* ── Add Symbol Form ───────────────────────── */}
      <div style={{
        display: 'flex',
        padding: '6px 8px',
        gap: '6px',
        borderBottom: '1px solid var(--qs-border)',
        background: 'var(--qs-bg-tertiary)',
        alignItems: 'center',
      }}>
        <input
          type="text"
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
          placeholder="Add ticker (e.g. AMD, NFLX)..."
          style={{
            flex: 1,
            background: 'var(--qs-bg-primary)',
            border: '1px solid var(--qs-border)',
            borderRadius: 'var(--qs-radius-sm, 4px)',
            color: 'var(--qs-text-primary)',
            fontFamily: 'var(--qs-font-mono)',
            fontSize: '11px',
            padding: '4px 8px',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
        />
        <button
          onClick={handleAdd}
          style={{
            background: 'var(--qs-blue, #357fe9)',
            border: 'none',
            borderRadius: 'var(--qs-radius-sm, 4px)',
            color: '#fff',
            fontFamily: 'var(--qs-font-mono)',
            fontWeight: 'bold',
            fontSize: '12px',
            padding: '4px 10px',
            cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1.0'}
        >
          +
        </button>
      </div>

      {/* ── Watchlist Table ──────────────────────── */}
      <div style={{ flexGrow: 1, overflowY: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: 'var(--qs-font-mono)',
          fontSize: 'var(--qs-font-xs)',
          textAlign: 'left',
        }}>
          <thead>
            <tr style={{
              borderBottom: '1px solid var(--qs-border)',
              color: 'var(--qs-text-muted)',
              position: 'sticky',
              top: 0,
              background: 'var(--qs-bg-secondary)',
              height: '32px',
            }}>
              <th style={{ padding: '0 8px' }}>Symbol</th>
              <th style={{ padding: '0 8px' }}>Name</th>
              <th style={{ padding: '0 8px', textAlign: 'right' }}>Last</th>
              <th style={{ padding: '0 8px', textAlign: 'right' }}>Chg %</th>
              <th style={{ padding: '0 8px', textAlign: 'right' }}>ATR</th>
              <th style={{ padding: '0 8px', textAlign: 'right' }}>RVOL</th>
              <th style={{ padding: '0 8px', width: '30px', textAlign: 'center' }}></th>
            </tr>
          </thead>
          <tbody>
            {watchlist.map((item) => {
              const tick = ticks[item.symbol]
              const last = tick && tick.price > 0 ? tick.price : item.prevClose
              const prevClose = tick && tick.prevClose > 0 ? tick.prevClose : (item.prevClose > 0 ? item.prevClose : last)
              const change = prevClose > 0 ? (last - prevClose) : 0.0
              const changePct = prevClose > 0 ? ((change / prevClose) * 100) : 0.0
              const isPositive = change >= 0

              return (
                <tr
                  key={item.symbol}
                  onClick={() => handleRowClick(item.symbol)}
                  className="watchlist-row"
                  style={{
                    height: '36px',
                    borderBottom: '1px solid var(--qs-border)',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <td style={{ padding: '0 8px', fontWeight: 'bold', color: 'var(--qs-text-primary)' }}>
                    {item.symbol}
                  </td>
                  <td style={{ padding: '0 8px', color: 'var(--qs-text-secondary)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.companyName}
                  </td>
                  <td style={{ padding: '0 8px', textAlign: 'right', fontWeight: 'bold' }}>
                    {last > 0 ? last.toFixed(2) : '--'}
                  </td>
                  <td style={{
                    padding: '0 8px',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: last > 0 && prevClose > 0 
                      ? (isPositive ? 'var(--qs-green)' : 'var(--qs-red)') 
                      : 'var(--qs-text-muted)',
                  }}>
                    {last > 0 && prevClose > 0 ? (isPositive ? '+' : '') : ''}
                    {last > 0 && prevClose > 0 ? `${changePct.toFixed(2)}%` : '--'}
                  </td>
                  <td style={{ padding: '0 8px', textAlign: 'right', color: 'var(--qs-text-secondary)' }}>
                    {item.atr > 0 ? item.atr.toFixed(2) : '--'}
                  </td>
                  <td style={{
                    padding: '0 8px',
                    textAlign: 'right',
                    fontWeight: item.rvol > 1.5 ? 'bold' : 'normal',
                    color: item.rvol > 1.5 ? 'var(--qs-amber)' : 'var(--qs-text-secondary)',
                  }}>
                    {item.rvol > 0 ? `${item.rvol.toFixed(1)}x` : '--'}
                  </td>
                  <td style={{ padding: '0 8px', textAlign: 'center' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeWatchlistSymbol(item.symbol)
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--qs-text-muted)',
                        fontSize: '14px',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        transition: 'color 0.2s, background 0.2s',
                        outline: 'none',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--qs-red)'
                        e.currentTarget.style.background = 'rgba(242, 54, 69, 0.1)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--qs-text-muted)'
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{
        padding: '8px',
        fontSize: '9px',
        color: 'var(--qs-text-muted)',
        textAlign: 'center',
        borderTop: '1px solid var(--qs-border)',
        flexShrink: 0,
      }}>
        Single-click ticker to load into execution workspace
      </div>
    </div>
  )
}
