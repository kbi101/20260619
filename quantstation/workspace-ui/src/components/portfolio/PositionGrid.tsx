import React, { useState, useMemo } from 'react'
import type { PortfolioPosition } from './types'

interface Props {
  positions: PortfolioPosition[]
}

type SortKey = keyof PortfolioPosition
type SortDir = 'asc' | 'desc'

/**
 * PositionGrid — Professional 19-column sortable position table.
 * The heart of the portfolio cockpit.
 */
export const PositionGrid: React.FC<Props> = ({ positions }) => {
  const [sortKey, setSortKey] = useState<SortKey>('todayPnl')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = useMemo(() => {
    return [...positions].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      const numA = Number(aVal)
      const numB = Number(bVal)
      return sortDir === 'asc' ? numA - numB : numB - numA
    })
  }, [positions, sortKey, sortDir])

  const fmt = (v: number, decimals = 2) => v.toFixed(decimals)
  const fmtPnl = (v: number) => `${v >= 0 ? '+' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  const fmtDollar = (v: number) => `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  const pnlClass = (v: number) => v > 0 ? 'pf-pos--up' : v < 0 ? 'pf-pos--down' : ''

  const regimeClass = (r: string) => {
    if (r === 'Bull') return 'pf-regime--bull'
    if (r === 'Bear') return 'pf-regime--bear'
    return 'pf-regime--neutral'
  }

  const columns: { key: SortKey; label: string; width: string }[] = [
    { key: 'symbol', label: 'Symbol', width: '72px' },
    { key: 'quantity', label: 'Qty', width: '60px' },
    { key: 'avgCost', label: 'Avg Cost', width: '76px' },
    { key: 'lastPrice', label: 'Last', width: '72px' },
    { key: 'marketValue', label: 'Mkt Value', width: '88px' },
    { key: 'todayPnl', label: "Today P&L", width: '84px' },
    { key: 'unrealizedPnl', label: 'Unreal', width: '80px' },
    { key: 'realizedPnl', label: 'Real', width: '72px' },
    { key: 'riskPercent', label: 'Risk %', width: '60px' },
    { key: 'allocationPercent', label: 'Alloc %', width: '60px' },
    { key: 'stopPrice', label: 'Stop', width: '68px' },
    { key: 'targetPrice', label: 'Target', width: '68px' },
    { key: 'rMultiple', label: 'R-Mult', width: '56px' },
    { key: 'holdingDays', label: 'Days', width: '48px' },
    { key: 'strategy', label: 'Strategy', width: '88px' },
    { key: 'aiScore', label: 'AI', width: '44px' },
    { key: 'confidence', label: 'Conf', width: '48px' },
    { key: 'hmmRegime', label: 'Regime', width: '64px' },
    { key: 'alertLevel', label: '⚠', width: '36px' },
  ]

  return (
    <div className="pf-section" id="section-positions">
      <div className="pf-section__header">
        <span className="pf-section__title">Open Positions</span>
        <span className="pf-section__count">{positions.length} positions</span>
      </div>
      <div className="pf-position-grid-wrapper">
        <table className="pf-position-grid">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{ width: col.width, minWidth: col.width }}
                  className={`pf-position-grid__th ${sortKey === col.key ? 'pf-position-grid__th--active' : ''}`}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="pf-position-grid__sort">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(pos => (
              <tr
                key={pos.symbol}
                className={`pf-position-grid__row ${pos.alertLevel === 'critical' ? 'pf-position-grid__row--critical' : pos.alertLevel === 'warning' ? 'pf-position-grid__row--warning' : ''}`}
              >
                <td className="pf-position-grid__symbol">
                  <span className="pf-position-grid__ticker">{pos.symbol}</span>
                </td>
                <td className={pos.quantity < 0 ? 'pf-pos--down' : ''}>{pos.quantity.toLocaleString()}</td>
                <td>{fmt(pos.avgCost)}</td>
                <td>{fmt(pos.lastPrice)}</td>
                <td>{fmtDollar(pos.marketValue)}</td>
                <td className={pnlClass(pos.todayPnl)}>{fmtPnl(pos.todayPnl)}</td>
                <td className={pnlClass(pos.unrealizedPnl)}>{fmtPnl(pos.unrealizedPnl)}</td>
                <td className={pnlClass(pos.realizedPnl)}>{fmtPnl(pos.realizedPnl)}</td>
                <td>{fmt(pos.riskPercent, 1)}%</td>
                <td>{fmt(pos.allocationPercent, 1)}%</td>
                <td>{pos.stopPrice ? fmt(pos.stopPrice) : '—'}</td>
                <td>{pos.targetPrice ? fmt(pos.targetPrice) : '—'}</td>
                <td className={pnlClass(pos.rMultiple)}>{pos.rMultiple >= 0 ? '+' : ''}{fmt(pos.rMultiple, 1)}</td>
                <td>{pos.holdingDays}d</td>
                <td><span className="pf-strategy-tag">{pos.strategy}</span></td>
                <td>
                  <span className={`pf-ai-score ${pos.aiScore >= 85 ? 'pf-ai-score--high' : pos.aiScore >= 65 ? 'pf-ai-score--mid' : 'pf-ai-score--low'}`}>
                    {pos.aiScore}
                  </span>
                </td>
                <td className="pf-pos--muted">{pos.confidence}%</td>
                <td><span className={`pf-regime ${regimeClass(pos.hmmRegime)}`}>{pos.hmmRegime}</span></td>
                <td>
                  {pos.alertLevel === 'critical' && <span className="pf-alert-dot pf-alert-dot--critical" title={pos.alertMessage || ''}>●</span>}
                  {pos.alertLevel === 'warning' && <span className="pf-alert-dot pf-alert-dot--warning" title={pos.alertMessage || ''}>●</span>}
                  {pos.alertLevel === 'info' && <span className="pf-alert-dot pf-alert-dot--info" title={pos.alertMessage || ''}>●</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
