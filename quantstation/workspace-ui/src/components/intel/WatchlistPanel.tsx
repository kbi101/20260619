import React from 'react'
import { useStore } from '../../store/useStore'

interface WatchlistTicker {
  symbol: string
  prevClose: number
  atr: number
  rvol: number
  companyName: string
}

const WATCHLIST_DATA: WatchlistTicker[] = [
  { symbol: 'SPY', prevClose: 520.50, atr: 4.80, rvol: 1.1, companyName: 'S&P 500 ETF' },
  { symbol: 'QQQ', prevClose: 440.20, atr: 5.50, rvol: 1.3, companyName: 'Nasdaq 100 ETF' },
  { symbol: 'AAPL', prevClose: 215.10, atr: 3.40, rvol: 0.9, companyName: 'Apple Inc.' },
  { symbol: 'NVDA', prevClose: 125.80, atr: 4.50, rvol: 2.2, companyName: 'NVIDIA Corp.' },
  { symbol: 'TSLA', prevClose: 180.20, atr: 6.20, rvol: 1.5, companyName: 'Tesla Inc.' },
  { symbol: 'MSFT', prevClose: 415.50, atr: 5.10, rvol: 0.8, companyName: 'Microsoft Corp.' },
  { symbol: 'AMZN', prevClose: 185.30, atr: 3.20, rvol: 1.2, companyName: 'Amazon.com Inc.' },
  { symbol: 'META', prevClose: 480.90, atr: 7.80, rvol: 1.4, companyName: 'Meta Platforms' },
]

export const WatchlistPanel: React.FC = () => {
  const ticks = useStore((state) => state.ticks)

  const handleRowClick = (symbol: string) => {
    console.log(`[WatchlistPanel] Selected symbol: ${symbol}. Triggering IPC...`)
    if (window.electronAPI?.selectSymbol) {
      window.electronAPI.selectSymbol(symbol)
    }
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      boxSizing: 'border-box',
    }}>
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
          </tr>
        </thead>
        <tbody>
          {WATCHLIST_DATA.map((item) => {
            const tick = ticks[item.symbol]
            const last = tick ? tick.price : item.prevClose
            const change = last - item.prevClose
            const changePct = (change / item.prevClose) * 100
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
                <td style={{ padding: '0 8px', color: 'var(--qs-text-secondary)' }}>
                  {item.companyName}
                </td>
                <td style={{ padding: '0 8px', textAlign: 'right', fontWeight: 'bold' }}>
                  {last.toFixed(2)}
                </td>
                <td style={{
                  padding: '0 8px',
                  textAlign: 'right',
                  fontWeight: 'bold',
                  color: isPositive ? 'var(--qs-green)' : 'var(--qs-red)',
                }}>
                  {isPositive ? '+' : ''}{changePct.toFixed(2)}%
                </td>
                <td style={{ padding: '0 8px', textAlign: 'right', color: 'var(--qs-text-secondary)' }}>
                  {item.atr.toFixed(2)}
                </td>
                <td style={{
                  padding: '0 8px',
                  textAlign: 'right',
                  fontWeight: item.rvol > 1.5 ? 'bold' : 'normal',
                  color: item.rvol > 1.5 ? 'var(--qs-amber)' : 'var(--qs-text-secondary)',
                }}>
                  {item.rvol.toFixed(1)}x
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{
        padding: '8px',
        fontSize: '9px',
        color: 'var(--qs-text-muted)',
        textAlign: 'center',
        borderTop: '1px solid var(--qs-border)',
        marginTop: '12px',
      }}>
        Single-click ticker to load into execution workspace
      </div>
    </div>
  )
}
