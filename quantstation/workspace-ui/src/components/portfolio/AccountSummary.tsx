import React from 'react'
import type { AccountSummaryData } from './types'

interface Props {
  account: AccountSummaryData
  riskBudgetUsed: number
}

/**
 * AccountSummary — Top KPI strip with 3 columns:
 * Account Metrics | Today's P&L | Risk Gauge
 */
export const AccountSummary: React.FC<Props> = ({ account, riskBudgetUsed }) => {
  const fmt = (v: number) => {
    const abs = Math.abs(v)
    if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
    if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
    return `$${v.toFixed(2)}`
  }

  const fmtPnl = (v: number) => {
    const sign = v >= 0 ? '+' : ''
    return `${sign}${fmt(v)}`
  }

  const pnlColor = (v: number) =>
    v > 0 ? 'var(--qs-green)' : v < 0 ? 'var(--qs-red)' : 'var(--qs-text-muted)'

  // Risk gauge SVG calculations
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const budgetPct = Math.min(100, Math.max(0, riskBudgetUsed))
  const offset = circumference - (budgetPct / 100) * circumference
  const riskColor = budgetPct >= 90 ? 'var(--qs-red)' : budgetPct >= 70 ? 'var(--qs-amber)' : 'var(--qs-green)'
  const riskLabel = budgetPct >= 90 ? 'HIGH' : budgetPct >= 70 ? 'MEDIUM' : 'LOW'

  return (
    <div className="pf-kpi-strip" id="section-summary">
      {/* ── Column 1: Account Metrics ────────────── */}
      <div className="pf-kpi-group">
        <div className="pf-kpi-group__title">Account Summary</div>
        <div className="pf-kpi-grid">
          <KPI label="Net Liquidation" value={fmt(account.netLiquidation)} />
          <KPI label="Cash" value={fmt(account.cash)} />
          <KPI label="Buying Power" value={fmt(account.buyingPower)} />
          <KPI label="Margin Remaining" value={fmt(account.marginRemaining)} />
          <KPI label="Portfolio Value" value={fmt(account.portfolioValue)} />
          <KPI label="Today's Return" value={`${account.todayReturn >= 0 ? '+' : ''}${account.todayReturn.toFixed(2)}%`} valueColor={pnlColor(account.todayReturn)} />
          <KPI label="YTD Return" value={`+${account.ytdReturn.toFixed(1)}%`} valueColor="var(--qs-green)" />
          <KPI label="Commissions" value={`$${account.commissions.toFixed(2)}`} valueColor="var(--qs-text-muted)" />
        </div>
      </div>

      {/* ── Column 2: Today's P&L ────────────────── */}
      <div className="pf-kpi-group">
        <div className="pf-kpi-group__title">Today's P&L</div>
        <div className="pf-pnl-hero">
          <span className="pf-pnl-hero__value" style={{ color: pnlColor(account.totalPnl) }}>
            {fmtPnl(account.totalPnl)}
          </span>
          <span className="pf-pnl-hero__pct" style={{ color: pnlColor(account.todayReturn) }}>
            {account.todayReturn >= 0 ? '+' : ''}{account.todayReturn.toFixed(2)}%
          </span>
        </div>
        <div className="pf-kpi-grid pf-kpi-grid--2col">
          <KPI label="Realized" value={fmtPnl(account.realizedPnl)} valueColor={pnlColor(account.realizedPnl)} />
          <KPI label="Unrealized" value={fmtPnl(account.unrealizedPnl)} valueColor={pnlColor(account.unrealizedPnl)} />
          <KPI label="Gross Exposure" value={fmt(account.grossExposure)} />
          <KPI label="Net Exposure" value={fmt(account.netExposure)} />
        </div>
      </div>

      {/* ── Column 3: Risk Gauge ─────────────────── */}
      <div className="pf-kpi-group pf-kpi-group--risk">
        <div className="pf-kpi-group__title">Risk Budget</div>
        <div className="pf-risk-gauge">
          <svg viewBox="0 0 128 128" className="pf-risk-gauge__svg">
            {/* Background ring */}
            <circle cx="64" cy="64" r={radius} fill="none" stroke="var(--qs-bg-elevated)" strokeWidth="8" />
            {/* Progress ring */}
            <circle
              cx="64" cy="64" r={radius}
              fill="none"
              stroke={riskColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="pf-risk-gauge__ring"
              transform="rotate(-90 64 64)"
            />
          </svg>
          <div className="pf-risk-gauge__label">
            <span className="pf-risk-gauge__pct" style={{ color: riskColor }}>{budgetPct}%</span>
            <span className="pf-risk-gauge__state" style={{ color: riskColor }}>{riskLabel}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────

const KPI: React.FC<{ label: string; value: string; valueColor?: string }> = ({ label, value, valueColor }) => (
  <div className="pf-kpi">
    <span className="pf-kpi__label">{label}</span>
    <span className="pf-kpi__value" style={valueColor ? { color: valueColor } : undefined}>{value}</span>
  </div>
)
