import React from 'react'
import { useStore } from '../../store/useStore'
import { CATEGORY_MAP } from './constants'
import type { ColumnDef, WatchlistSymbol } from './types'

interface SymbolGridProps {
  categoryConfig: typeof CATEGORY_MAP[keyof typeof CATEGORY_MAP]
  symbols: WatchlistSymbol[]
}

export const SymbolGrid: React.FC<SymbolGridProps> = ({ categoryConfig, symbols }) => {
  const {
    ticks,
    selectedWatchlistSymbol,
    setSelectedWatchlistSymbol,
    setActiveSymbol,
    watchlistSort,
    setWatchlistSort,
    removeManualSymbol,
    toggleFavorite,
    favoriteSymbols,
    updateManualNote,
  } = useStore()

  const handleRowClick = (symbolStr: string) => {
    setSelectedWatchlistSymbol(symbolStr)
    setActiveSymbol(symbolStr)
    if (window.electronAPI?.selectSymbol) {
      window.electronAPI.selectSymbol(symbolStr)
    }
  }

  const handleRowDoubleClick = (symbolStr: string) => {
    setSelectedWatchlistSymbol(symbolStr)
    setActiveSymbol(symbolStr)
    if (window.electronAPI?.selectSymbol) {
      window.electronAPI.selectSymbol(symbolStr)
    }
  }

  // Sorting
  const sortedSymbols = [...symbols].sort((a, b) => {
    const colKey = watchlistSort.column
    const dir = watchlistSort.direction === 'asc' ? 1 : -1

    // Merge tick data for dynamic sorting
    const tickA = ticks[a.symbol]
    const tickB = ticks[b.symbol]

    const valA = (tickA && colKey in tickA ? (tickA as any)[colKey] : (a as any)[colKey]) ?? 0
    const valB = (tickB && colKey in tickB ? (tickB as any)[colKey] : (b as any)[colKey]) ?? 0

    if (typeof valA === 'number' && typeof valB === 'number') {
      return (valA - valB) * dir
    }
    return String(valA).localeCompare(String(valB)) * dir
  })

  const formatCellValue = (col: ColumnDef, item: WatchlistSymbol) => {
    const tick = ticks[item.symbol]
    const lastPrice = tick && tick.price > 0 ? tick.price : item.price
    const prevClose = tick && tick.prevClose > 0 ? tick.prevClose : item.prevClose

    if (col.key === 'symbol') return item.symbol
    if (col.key === 'price') return lastPrice > 0 ? lastPrice.toFixed(2) : '--'
    if (col.key === 'changePercent') {
      if (lastPrice > 0 && prevClose > 0) {
        const change = lastPrice - prevClose
        const pct = (change / prevClose) * 100
        const sign = pct >= 0 ? '+' : ''
        return `${sign}${pct.toFixed(2)}%`
      }
      return '--'
    }
    if (col.key === 'volume') {
      const vol = (tick && tick.volume && tick.volume > 0) ? tick.volume : item.volume
      if (vol >= 1000000000) return `${(vol / 1000000000).toFixed(2)}B`
      if (vol >= 1000000) return `${(vol / 1000000).toFixed(2)}M`
      if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`
      return vol > 0 ? String(vol) : '--'
    }
    if (col.key === 'rvol') {
      const liveVol = (tick && tick.volume && tick.volume > 0) ? tick.volume : item.volume
      if (liveVol > 0 && item.avgVolume && item.avgVolume > 0) {
        const calculatedRvol = liveVol / item.avgVolume
        return `${calculatedRvol.toFixed(1)}x`
      }
      return item.rvol > 0 ? `${item.rvol.toFixed(1)}x` : '--'
    }
    if (col.key === 'atr') return item.atr > 0 ? `$${item.atr.toFixed(2)}` : '--'
    if (col.key === 'spread') {
      if (tick && tick.bidPrice > 0 && tick.askPrice > 0) {
        const liveSpread = Math.max(0, tick.askPrice - tick.bidPrice)
        return `$${liveSpread.toFixed(2)}`
      }
      return item.spread > 0 ? `$${item.spread.toFixed(2)}` : '--'
    }
    if (col.key === 'float') return item.float > 0 ? `${(item.float / 1000000).toFixed(1)}M` : '--'
    if (col.key === 'marketCap') return item.marketCap > 0 ? `$${(item.marketCap / 1000000000).toFixed(1)}B` : '--'

    const raw = (item as any)[col.key]
    return raw !== undefined && raw !== null ? String(raw) : '--'
  }

  const getCellStyles = (col: ColumnDef, item: WatchlistSymbol) => {
    const tick = ticks[item.symbol]
    const lastPrice = tick && tick.price > 0 ? tick.price : item.price
    const prevClose = tick && tick.prevClose > 0 ? tick.prevClose : item.prevClose

    let color = 'inherit'
    let fontWeight = 'normal'

    if (col.key === 'changePercent' && lastPrice > 0 && prevClose > 0) {
      const pct = ((lastPrice - prevClose) / prevClose) * 100
      if (pct >= 5) {
        color = 'var(--qs-green)'
        fontWeight = 'bold'
      } else if (pct > 0) {
        color = 'var(--qs-green)'
      } else if (pct <= -5) {
        color = 'var(--qs-red)'
        fontWeight = 'bold'
      } else if (pct < 0) {
        color = 'var(--qs-red)'
      }
    } else if (col.key === 'rvol') {
      if (item.rvol >= 5) {
        color = 'var(--qs-amber)'
        fontWeight = 'bold'
      } else if (item.rvol >= 3) {
        color = 'var(--qs-amber)'
        fontWeight = 'bold'
      }
    } else if (col.key === 'spread') {
      if (item.spread <= 0.05) color = 'var(--qs-green)'
      else if (item.spread >= 0.5) color = 'var(--qs-red)'
    }

    return { color, fontWeight }
  }

  if (categoryConfig.phase > 1) {
    return (
      <div className="wl-grid-placeholder">
        <div className="wl-grid-placeholder__icon">{categoryConfig.icon}</div>
        <div className="wl-grid-placeholder__title">{categoryConfig.label} Watchlist</div>
        <div className="wl-grid-placeholder__desc">
          {categoryConfig.description}
        </div>
        <div className="wl-grid-placeholder__phase">
          Scheduled for Phase {categoryConfig.phase} Implementation
        </div>
      </div>
    )
  }

  return (
    <div className="wl-grid-container">
      <table className="wl-table">
        <thead>
          <tr className="wl-table__header-row">
            <th style={{ width: 28, textAlign: 'center' }}></th>
            {categoryConfig.columns.map((col) => (
              <th
                key={col.key}
                onClick={() => col.sortable && setWatchlistSort(col.key)}
                style={{
                  width: col.width,
                  textAlign: col.align,
                  cursor: col.sortable ? 'pointer' : 'default',
                }}
                className="wl-table__th"
              >
                {col.label}
                {watchlistSort.column === col.key && (
                  <span className="wl-table__sort-icon">
                    {watchlistSort.direction === 'asc' ? ' ▲' : ' ▼'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedSymbols.length === 0 ? (
            <tr>
              <td colSpan={categoryConfig.columns.length + 1} className="wl-table__empty">
                No symbols in {categoryConfig.label} watchlist. Add a ticker above!
              </td>
            </tr>
          ) : (
            sortedSymbols.map((item) => {
              const isSelected = selectedWatchlistSymbol === item.symbol
              const isFav = favoriteSymbols.includes(item.symbol)

              return (
                <tr
                  key={item.symbol}
                  onClick={() => handleRowClick(item.symbol)}
                  onDoubleClick={() => handleRowDoubleClick(item.symbol)}
                  className={`wl-table__row ${isSelected ? 'wl-table__row--selected' : ''}`}
                >
                  {/* Favorite heart toggle */}
                  <td style={{ textAlign: 'center', width: 28 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavorite(item.symbol)
                      }}
                      className={`wl-fav-btn ${isFav ? 'wl-fav-btn--active' : ''}`}
                      title={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
                    >
                      {isFav ? '❤️' : '🤍'}
                    </button>
                  </td>

                  {categoryConfig.columns.map((col) => {
                    if (col.key === '__remove') {
                      return (
                        <td key={col.key} style={{ textAlign: 'center', width: 28 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              removeManualSymbol(item.symbol)
                            }}
                            className="wl-remove-btn"
                            title="Remove ticker"
                          >
                            &times;
                          </button>
                        </td>
                      )
                    }

                    if (col.key === 'notes') {
                      return (
                        <td key={col.key} style={{ padding: '0 6px' }}>
                          <input
                            type="text"
                            value={item.notes || ''}
                            onChange={(e) => updateManualNote(item.symbol, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Add note..."
                            className="wl-notes-input"
                          />
                        </td>
                      )
                    }

                    const style = getCellStyles(col, item)
                    const val = formatCellValue(col, item)

                    return (
                      <td
                        key={col.key}
                        style={{
                          textAlign: col.align,
                          color: style.color,
                          fontWeight: style.fontWeight as any,
                          padding: '0 8px',
                        }}
                        className="wl-table__td"
                      >
                        {val}
                      </td>
                    )
                  })}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
