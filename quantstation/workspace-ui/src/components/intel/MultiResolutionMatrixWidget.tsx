import React, { useState, useEffect } from 'react'
import { MultiResolutionSimulatorPanel } from './MultiResolutionSimulatorPanel'

export interface TimeframeSignal {
  timeframe: string
  signal: string
  badge: string
  lastPx: number
  zScore: number
  rsi: number
  adx: number
  macdHist: number
  regimeLabel: string
  details: string
}

export interface SymbolConsensus {
  symbol: string
  lastPx: number
  consensusCode: string
  consensusBadge: string
  signals: Record<string, TimeframeSignal>
  evaluatedAt: string
}

export const MultiResolutionMatrixWidget: React.FC = () => {
  const [data, setData] = useState<Record<string, SymbolConsensus>>({})
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [showSimulator, setShowSimulator] = useState<boolean>(false)

  const fetchMatrix = async () => {
    try {
      const res = await fetch('http://localhost:8080/api/v1/signals/multi-resolution')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Multi-Resolution Engine')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMatrix()
    const interval = setInterval(fetchMatrix, 5000)
    return () => clearInterval(interval)
  }, [])

  const getBadgeStyle = (badge: string) => {
    if (badge.includes('BUY') || badge.includes('🚀')) {
      return { background: '#10B98122', color: '#10B981', border: '1px solid #10B98144' }
    } else if (badge.includes('SELL') || badge.includes('📉')) {
      return { background: '#EF444422', color: '#EF4444', border: '1px solid #EF444444' }
    } else if (badge.includes('FILTERED') || badge.includes('⚠️')) {
      return { background: '#F59E0B22', color: '#F59E0B', border: '1px solid #F59E0B44' }
    }
    return { background: 'var(--qs-bg-primary)', color: 'var(--qs-text-secondary)', border: '1px solid var(--qs-border)' }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: 'var(--qs-bg-secondary)',
      color: 'var(--qs-text-primary)',
      fontSize: 'var(--qs-font-sm, 12px)',
      overflow: 'hidden',
    }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid var(--qs-border)',
        background: 'var(--qs-bg-primary)',
      }}>
        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚡ Multi-Resolution Consensus Matrix</span>
          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#3B82F622', color: '#3B82F6', border: '1px solid #3B82F644' }}>
            2m • 5m • 15m • 30m • 1h • 4h
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowSimulator(!showSimulator)}
            style={{
              background: showSimulator ? '#3B82F622' : 'transparent',
              border: `1px solid ${showSimulator ? '#3B82F666' : 'var(--qs-border)'}`,
              borderRadius: '4px',
              color: showSimulator ? '#3B82F6' : 'var(--qs-text-secondary)',
              padding: '2px 8px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            {showSimulator ? '✕ Close Simulator' : '🧪 Simulator'}
          </button>
          <button
            onClick={fetchMatrix}
            style={{
              background: 'transparent',
              border: '1px solid var(--qs-border)',
              borderRadius: '4px',
              color: 'var(--qs-text-secondary)',
              padding: '2px 8px',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Simulator Panel Container */}
      {showSimulator && (
        <MultiResolutionSimulatorPanel onScenarioInjected={fetchMatrix} />
      )}

      {/* Table Container */}
      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '8px' }}>
        {loading && <div style={{ padding: '16px', color: 'var(--qs-text-secondary)' }}>Loading Multi-Resolution Matrix...</div>}
        {error && (
          <div style={{ padding: '12px', color: '#EF4444', background: '#EF444411', border: '1px solid #EF444433', borderRadius: '4px', marginBottom: '8px' }}>
            Backend offline or standby: {error}
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'var(--qs-font-mono)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--qs-border)', color: 'var(--qs-text-secondary)', fontSize: '11px' }}>
              <th style={{ padding: '6px' }}>Symbol</th>
              <th style={{ padding: '6px' }}>Last Px</th>
              <th style={{ padding: '6px' }}>2m</th>
              <th style={{ padding: '6px' }}>5m</th>
              <th style={{ padding: '6px' }}>15m</th>
              <th style={{ padding: '6px' }}>30m</th>
              <th style={{ padding: '6px' }}>1h</th>
              <th style={{ padding: '6px' }}>4h</th>
              <th style={{ padding: '6px' }}>Multi-Timeframe Consensus</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(data).length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: 'var(--qs-text-secondary)' }}>
                  No active symbol consensus evaluated yet. Core Engine warming up bars...
                </td>
              </tr>
            ) : (
              Object.entries(data).map(([sym, item]) => (
                <React.Fragment key={sym}>
                  <tr
                    onClick={() => setSelectedSymbol(selectedSymbol === sym ? null : sym)}
                    style={{
                      borderBottom: '1px solid var(--qs-border)',
                      cursor: 'pointer',
                      background: selectedSymbol === sym ? 'var(--qs-bg-hover, #ffffff08)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '6px', fontWeight: 600 }}>{sym}</td>
                    <td style={{ padding: '6px' }}>${item.lastPx?.toFixed(2) || '0.00'}</td>
                    {['2m', '5m', '15m', '30m', '1h', '4h'].map(tf => {
                      const sig = item.signals?.[tf]
                      const badge = sig?.badge || '❓ N/A'
                      return (
                        <td key={tf} style={{ padding: '6px' }}>
                          <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', ...getBadgeStyle(badge) }}>
                            {badge}
                          </span>
                        </td>
                      )
                    })}
                    <td style={{ padding: '6px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '11px', ...getBadgeStyle(item.consensusBadge) }}>
                        {item.consensusBadge}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded Breakdown for Symbol */}
                  {selectedSymbol === sym && (
                    <tr style={{ background: 'var(--qs-bg-primary)' }}>
                      <td colSpan={9} style={{ padding: '12px', borderBottom: '1px solid var(--qs-border)' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '8px', color: '#3B82F6' }}>
                          Per-Timeframe Breakdown for {sym}
                        </div>
                        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ color: 'var(--qs-text-secondary)', borderBottom: '1px solid var(--qs-border)' }}>
                              <th style={{ textAlign: 'left', padding: '4px' }}>Timeframe</th>
                              <th style={{ textAlign: 'left', padding: '4px' }}>Z-Score</th>
                              <th style={{ textAlign: 'left', padding: '4px' }}>RSI</th>
                              <th style={{ textAlign: 'left', padding: '4px' }}>ADX</th>
                              <th style={{ textAlign: 'left', padding: '4px' }}>MACD Hist</th>
                              <th style={{ textAlign: 'left', padding: '4px' }}>Regime</th>
                              <th style={{ textAlign: 'left', padding: '4px' }}>Signal Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(item.signals || {}).map(([tf, s]) => (
                              <tr key={tf} style={{ borderBottom: '1px dotted var(--qs-border)' }}>
                                <td style={{ padding: '4px', fontWeight: 600 }}>{tf}</td>
                                <td style={{ padding: '4px' }}>{s.zScore?.toFixed(2)}</td>
                                <td style={{ padding: '4px' }}>{s.rsi?.toFixed(1)}</td>
                                <td style={{ padding: '4px' }}>{s.adx?.toFixed(1)}</td>
                                <td style={{ padding: '4px' }}>{s.macdHist?.toFixed(3)}</td>
                                <td style={{ padding: '4px' }}>{s.regimeLabel}</td>
                                <td style={{ padding: '4px', color: 'var(--qs-text-secondary)' }}>{s.details}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
