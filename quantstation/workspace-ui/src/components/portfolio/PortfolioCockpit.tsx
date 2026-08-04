import React, { useRef } from 'react'
import { useMarketStream } from '../../hooks/useMarketStream'
import { useStore } from '../../store/useStore'
import { usePortfolioData } from './usePortfolioData'
import { AccountSummary } from './AccountSummary'
import { PositionGrid } from './PositionGrid'
import { RiskDashboard } from './RiskDashboard'
import { SectorExposure } from './SectorExposure'
import { StrategyAllocation } from './StrategyAllocation'
import { MarketExposure } from './MarketExposure'
import { PositionRiskRanking } from './PositionRiskRanking'
import { AIPositionHealth } from './AIPositionHealth'
import { PerformanceAttribution } from './PerformanceAttribution'
import { OpenOrders } from './OpenOrders'
import { AlertsFeed } from './AlertsFeed'
import { AIRecommendations } from './AIRecommendations'
import { ActivityTimeline } from './ActivityTimeline'
import type { BrokerageAccountInfo } from './types'

const TAB_SECTIONS = [
  { id: 'section-summary', label: 'Summary' },
  { id: 'section-positions', label: 'Positions' },
  { id: 'section-risk', label: 'Risk' },
  { id: 'section-exposure', label: 'Exposure' },
  { id: 'section-attribution', label: 'Attribution' },
  { id: 'section-ai', label: 'AI Health' },
  { id: 'section-orders', label: 'Orders' },
  { id: 'section-alerts', label: 'Alerts' },
]

/**
 * PortfolioCockpit — Real-Time Risk Management Cockpit (SPEC-007)
 *
 * Scrollable single-page layout with sticky tab navigation.
 * All 14 sections render simultaneously for instant visibility.
 */
export const PortfolioCockpit: React.FC = () => {
  useMarketStream()
  const data = usePortfolioData()
  const scrollRef = useRef<HTMLDivElement>(null)
  const { selectedAccountId, setSelectedAccountId, availableAccounts } = useStore()

  const handleTabClick = (sectionId: string) => {
    const el = document.getElementById(sectionId)
    if (el && scrollRef.current) {
      const containerTop = scrollRef.current.getBoundingClientRect().top
      const elTop = el.getBoundingClientRect().top
      const offset = elTop - containerTop + scrollRef.current.scrollTop - 48 // tab bar height
      scrollRef.current.scrollTo({ top: offset, behavior: 'smooth' })
    }
  }

  const fmtPnl = (v: number) => `${v >= 0 ? '+' : ''}$${Math.abs(v).toLocaleString()}`
  const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

  return (
    <div className="pf-cockpit">
      {/* ── Title Bar ────────────────────────────────── */}
      <div className="titlebar" style={{ flexShrink: 0 }}>
        <span className="titlebar__title">Portfolio</span>
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
          } as any}
        >
          Workspace
        </button>

        {/* Multi-Brokerage Account Selector */}
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          style={{
            fontFamily: 'var(--qs-font-mono)',
            fontSize: 'var(--qs-font-xs)',
            background: 'var(--qs-bg-tertiary)',
            border: '1px solid var(--qs-border)',
            borderRadius: 'var(--qs-radius-sm)',
            color: 'var(--qs-text-primary)',
            padding: '3px 8px',
            outline: 'none',
            cursor: 'pointer',
            WebkitAppRegion: 'no-drag',
          } as any}
        >
          {availableAccounts.map((acc: BrokerageAccountInfo) => (
            <option key={acc.accountId} value={acc.accountId}>
              [{acc.provider}] {acc.accountName} {acc.accountId !== 'ALL' ? `(${acc.accountId})` : ''}
            </option>
          ))}
        </select>
        <div className="pf-titlebar-kpis">
          <span className="pf-titlebar-kpi">
            <span className="pf-titlebar-kpi__label">Net Liq</span>
            <span className="pf-titlebar-kpi__value">
              ${(data.account.netLiquidation / 1_000_000).toFixed(2)}M
            </span>
          </span>
          <span className="pf-titlebar-kpi">
            <span className="pf-titlebar-kpi__label">P&L</span>
            <span
              className="pf-titlebar-kpi__value"
              style={{ color: data.account.totalPnl >= 0 ? 'var(--qs-green)' : 'var(--qs-red)' }}
            >
              {fmtPnl(data.account.totalPnl)} ({fmtPct(data.account.todayReturn)})
            </span>
          </span>
          <span className="pf-titlebar-kpi">
            <span className="pf-titlebar-kpi__label">VaR</span>
            <span className="pf-titlebar-kpi__value" style={{ color: 'var(--qs-amber)' }}>
              ${Math.abs(data.risk.var95 / 1_000).toFixed(1)}K
            </span>
          </span>
          <span className="pf-titlebar-kpi">
            <span className="pf-titlebar-kpi__label">Risk</span>
            <span
              className="pf-titlebar-kpi__value"
              style={{
                color: data.risk.riskBudgetUsed >= 90 ? 'var(--qs-red)' : data.risk.riskBudgetUsed >= 70 ? 'var(--qs-amber)' : 'var(--qs-green)',
              }}
            >
              {data.risk.riskBudgetUsed}%
            </span>
          </span>
        </div>
      </div>

      {/* ── Tab Navigation (sticky) ──────────────────── */}
      <nav className="pf-tab-nav">
        {TAB_SECTIONS.map(tab => (
          <button
            key={tab.id}
            className="pf-tab-nav__btn"
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ── Scrollable Content ───────────────────────── */}
      <div className="pf-scroll-area" ref={scrollRef}>

        {/* ── Account Summary KPI Strip ──────────────── */}
        <AccountSummary account={data.account} riskBudgetUsed={data.risk.riskBudgetUsed} />

        {/* ── Position Grid ──────────────────────────── */}
        <PositionGrid positions={data.positions} />

        {/* ── Analytics Row 1: Risk + Exposure + AI Rec ─ */}
        <div className="pf-analytics-row" id="section-risk">
          <RiskDashboard risk={data.risk} />
          <MarketExposure exposure={data.marketExposure} />
          <AIRecommendations recommendations={data.recommendations} />
        </div>

        {/* ── Analytics Row 2: Sector + Strategy + Risk Rank */}
        <div className="pf-analytics-row" id="section-exposure">
          <SectorExposure sectors={data.sectorExposure} />
          <StrategyAllocation strategies={data.strategyAllocation} />
          <PositionRiskRanking risks={data.positionRisks} />
        </div>

        {/* ── Analytics Row 3: AI Health + Attribution ── */}
        <div className="pf-analytics-row pf-analytics-row--2col" id="section-attribution">
          <AIPositionHealth health={data.aiHealth} />
          <PerformanceAttribution attribution={data.attribution} />
        </div>

        {/* ── Bottom Row: Orders + Alerts & Timeline ──── */}
        <div className="pf-analytics-row pf-analytics-row--2col" id="section-orders">
          <OpenOrders orders={data.openOrders} />
          <div className="pf-bottom-right" id="section-alerts">
            <AlertsFeed alerts={data.alerts} />
            <ActivityTimeline events={data.timeline} />
          </div>
        </div>

        {/* Bottom padding */}
        <div style={{ height: '24px', flexShrink: 0 }} />
      </div>
    </div>
  )
}
