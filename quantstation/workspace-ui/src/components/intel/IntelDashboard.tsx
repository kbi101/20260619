import React from 'react'
import { useMarketStream } from '../../hooks/useMarketStream'
import { WatchlistPanel } from './WatchlistPanel'
import { DailyChecklist } from './DailyChecklist'

/**
 * IntelDashboard — Secondary Window Layout
 *
 * Renders a 2x2 grid dashboard for watchlists, news, economic calendar, and notes.
 */
export const IntelDashboard: React.FC = () => {
  // Initialize WebSocket connection for the secondary window
  useMarketStream()

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--qs-bg-secondary)',
      color: 'var(--qs-text-primary)',
      overflow: 'hidden',
    }}>
      {/* ── Title Bar ──────────────────────────────── */}
      <div className="titlebar" style={{ flexShrink: 0 }}>
        <span className="titlebar__title">Intel Dashboard</span>
        <button
          onClick={() => window.electronAPI?.openWorkspaceWindow()}
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
            marginRight: '12px',
          } as any}
        >
          Workspace
        </button>
        <span style={{
          fontFamily: 'var(--qs-font-mono)',
          fontSize: 'var(--qs-font-xs)',
          color: 'var(--qs-text-secondary)',
          background: 'var(--qs-bg-primary)',
          padding: '2px 8px',
          borderRadius: 'var(--qs-radius-sm)',
        }}>
          MARKET INTEL
        </span>
      </div>

      {/* ── 2-Column Grid Layout ───────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 0.8fr',
        gridTemplateRows: '1fr',
        gap: 'var(--qs-gap-sm, 12px)',
        padding: 'var(--qs-gap-sm, 12px)',
        flexGrow: 1,
        height: 'calc(100vh - 38px)',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}>
        {/* Watchlist Panel */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="panel__header">
            <span className="panel__title">❶ Watchlist</span>
          </div>
          <div className="panel__content" style={{ padding: 0, overflow: 'hidden' }}>
            <WatchlistPanel />
          </div>
        </div>

        {/* Daily Checklist & Targets */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="panel__header">
            <span className="panel__title">❷ Daily Targets & Checklist</span>
          </div>
          <div className="panel__content" style={{ padding: 0, overflow: 'hidden' }}>
            <DailyChecklist />
          </div>
        </div>
      </div>
    </div>
  )
}
