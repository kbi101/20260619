import React from 'react'
import { useMarketStream } from '../../hooks/useMarketStream'
import { useStore } from '../../store/useStore'
import { CategorySidebar } from './CategorySidebar'
import { SymbolGrid } from './SymbolGrid'
import { AddSymbolBar } from './AddSymbolBar'
import { DetailPanel } from './DetailPanel'
import { StatusBar } from './StatusBar'
import { CATEGORY_MAP } from './constants'
import type { WatchlistSymbol } from './types'

/**
 * WatchlistCommandCenter — Multi-Watchlist Command Center (SPEC-006 Phase 1)
 *
 * Replaces old IntelDashboard with a 3-panel layout:
 * Category Sidebar (left) | Symbol Grid + Add Bar (center) | Detail Panel (right)
 */
export const WatchlistCommandCenter: React.FC = () => {
  // Ensure STOMP market stream is connected
  useMarketStream()

  const { activeCategory, manualSymbols, favoriteSymbols } = useStore()
  const activeConfig = CATEGORY_MAP[activeCategory] || CATEGORY_MAP['manual']

  // Determine symbols for active category
  let displaySymbols: WatchlistSymbol[] = []
  if (activeCategory === 'manual') {
    displaySymbols = manualSymbols
  } else if (activeCategory === 'favorites') {
    displaySymbols = manualSymbols.filter((s) => favoriteSymbols.includes(s.symbol))
  }

  return (
    <div className="wl-command-center">
      {/* ── Custom Title Bar ─────────────────────────── */}
      <div className="titlebar" style={{ flexShrink: 0 }}>
        <span className="titlebar__title">Watchlists Command Center</span>
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
          MULTI-WATCHLIST SYSTEM
        </span>
      </div>

      {/* ── 3-Panel Main Layout ──────────────────────── */}
      <div className="wl-main-body">
        {/* Left: Category Sidebar */}
        <CategorySidebar />

        {/* Center: Symbol Grid & Add Bar */}
        <div className="wl-center-panel">
          {activeConfig.allowManualAdd && <AddSymbolBar />}
          <SymbolGrid categoryConfig={activeConfig} symbols={displaySymbols} />
        </div>

        {/* Right: Detail Panel */}
        <DetailPanel />
      </div>

      {/* ── Bottom Status Bar ───────────────────────── */}
      <StatusBar symbolCount={displaySymbols.length} />
    </div>
  )
}
