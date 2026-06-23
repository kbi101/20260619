import React, { useEffect, useState } from 'react'
import { useMarketStream } from './hooks/useMarketStream'
import { useStore } from './store/useStore'
import { OrderBook } from './components/orderbook/OrderBook'
import { PriceChart } from './components/charting/PriceChart'
import { OrderEntry } from './components/execution/OrderEntry'
import { OrderBlotter } from './components/execution/OrderBlotter'
import { PnlTicker } from './components/pnl/PnlTicker'
import { IntelDashboard } from './components/intel/IntelDashboard'
import { SnapshotsBoard } from './components/snapshots/SnapshotsBoard'

/**
 * QuantStation — Main Workspace Grid Board Component
 */
const Workspace: React.FC = () => {
  const { connected, ibkrConnected, activeSymbol, setActiveSymbol } = useStore()

  // Register Electron IPC listener for cross-window symbol selections
  useEffect(() => {
    if (window.electronAPI?.onSymbolUpdate) {
      const unsubscribe = window.electronAPI.onSymbolUpdate((newSymbol) => {
        console.log(`[Workspace UI] Symbol update received via IPC: ${newSymbol}`)
        setActiveSymbol(newSymbol)
      })
      return unsubscribe
    }
    return undefined
  }, [setActiveSymbol])

  return (
    <>
      {/* ── Title Bar ──────────────────────────────── */}
      <div className="titlebar">
        <span className="titlebar__title">Workspace</span>
        <span style={{
          fontFamily: 'var(--qs-font-mono)',
          fontSize: 'var(--qs-font-sm)',
          color: 'var(--qs-text-primary)',
          background: 'var(--qs-bg-primary)',
          padding: '2px 8px',
          borderRadius: 'var(--qs-radius-sm)',
        }}>
          {activeSymbol}
        </span>
        <input
          id="symbol-search"
          placeholder="Search symbol..."
          style={{
            fontFamily: 'var(--qs-font-mono)',
            fontSize: 'var(--qs-font-xs)',
            background: 'var(--qs-bg-primary)',
            border: '1px solid var(--qs-border)',
            borderRadius: 'var(--qs-radius-sm)',
            color: 'var(--qs-text-primary)',
            padding: '4px 8px',
            width: '120px',
            outline: 'none',
            WebkitAppRegion: 'no-drag',
          } as any}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = (e.target as HTMLInputElement).value.toUpperCase()
              if (val) setActiveSymbol(val)
            }
          }}
        />
        <button
          onClick={() => window.electronAPI?.openIntelWindow()}
          style={{
            fontFamily: 'var(--qs-font-sans)',
            fontSize: 'var(--qs-font-xs)',
            background: 'var(--qs-bg-primary)',
            border: '1px solid var(--qs-border)',
            borderRadius: 'var(--qs-radius-sm)',
            color: 'var(--qs-text-secondary)',
            padding: '4px 10px',
            cursor: 'pointer',
            WebkitAppRegion: 'no-drag',
            outline: 'none',
          } as any}
        >
          Intel Dashboard
        </button>
        <button
          onClick={() => window.electronAPI?.openSnapshotsWindow()}
          style={{
            fontFamily: 'var(--qs-font-sans)',
            fontSize: 'var(--qs-font-xs)',
            background: 'var(--qs-bg-primary)',
            border: '1px solid var(--qs-border)',
            borderRadius: 'var(--qs-radius-sm)',
            color: 'var(--qs-text-secondary)',
            padding: '4px 10px',
            cursor: 'pointer',
            WebkitAppRegion: 'no-drag',
            outline: 'none',
          } as any}
        >
          Snapshots Board
        </button>
        <span className="titlebar__status" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className={`pulse-dot ${ibkrConnected ? 'pulse-dot--active' : 'pulse-dot--inactive'}`} />
          <span className={ibkrConnected ? 'titlebar__status--connected' : 'titlebar__status--disconnected'}>
            {ibkrConnected ? 'LIVE' : 'DISCONNECTED'}
          </span>
        </span>
      </div>

      {/* ── Workspace Grid ─────────────────────────── */}
      <div className="workspace">
        {/* Order Book Panel */}
        <div className="panel panel--orderbook">
          <div className="panel__header">
            <span className="panel__title">Order Book — {activeSymbol}</span>
          </div>
          <div className="panel__content" style={{ padding: 0 }}>
            <OrderBook />
          </div>
        </div>

        {/* Chart Panel */}
        <div className="panel panel--chart">
          <div className="panel__header">
            <span className="panel__title">Chart — {activeSymbol}</span>
          </div>
          <div className="panel__content" style={{ padding: 0 }}>
            <PriceChart />
          </div>
        </div>

        {/* Execution Panel (Order Entry + PnL) */}
        <div className="panel panel--execution">
          <div className="panel__header">
            <span className="panel__title">Execution</span>
          </div>
          <div className="panel__content" style={{ padding: 0, overflowY: 'auto' }}>
            <OrderEntry />
            <div style={{
              borderTop: '1px solid var(--qs-border)',
              marginTop: 'var(--qs-gap-sm)',
            }}>
              <div className="panel__header">
                <span className="panel__title">Positions & PnL</span>
              </div>
              <PnlTicker />
            </div>
          </div>
        </div>

        {/* Blotter Panel */}
        <div className="panel panel--blotter">
          <div className="panel__header">
            <span className="panel__title">Order Blotter</span>
          </div>
          <div className="panel__content" style={{ padding: 0 }}>
            <OrderBlotter />
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * Root Router App Component
 */
const App: React.FC = () => {
  // Initialize WebSocket connection at root to enable continuous status polling
  useMarketStream()

  const { ibkrConnected } = useStore()
  const [route, setRoute] = useState(window.location.hash)

  useEffect(() => {
    const handleHashChange = () => {
      console.log(`[HashRouter] Navigating to hash: ${window.location.hash}`)
      setRoute(window.location.hash)
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  if (route.startsWith('#/snapshots')) {
    return <SnapshotsBoard />
  }

  if (route.startsWith('#/intel')) {
    return <IntelDashboard />
  }

  return <Workspace />
}

export default App
