import React from 'react'
import type { RiskMetrics } from './types'

interface Props {
  risk: RiskMetrics
}

/**
 * RiskDashboard — Greeks, VaR, stress tests, Kelly utilization.
 * Where professionals spend most of their attention.
 */
export const RiskDashboard: React.FC<Props> = ({ risk }) => {
  const fmtDollar = (v: number) => {
    const sign = v >= 0 ? '' : '-'
    const abs = Math.abs(v)
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
    return `${sign}$${abs.toFixed(0)}`
  }

  const rows: { label: string; value: string; warn?: boolean }[] = [
    { label: 'Portfolio Beta', value: risk.portfolioBeta.toFixed(2), warn: risk.portfolioBeta > 1.2 },
    { label: 'Portfolio Delta', value: risk.portfolioDelta.toFixed(2) },
    { label: 'Portfolio Gamma', value: risk.portfolioGamma.toFixed(3) },
    { label: 'Portfolio Vega', value: risk.portfolioVega.toFixed(2) },
    { label: 'Portfolio Theta', value: fmtDollar(risk.portfolioTheta) },
    { label: 'Correlation', value: risk.portfolioCorrelation.toFixed(2), warn: risk.portfolioCorrelation > 0.7 },
    { label: 'VaR (95%)', value: fmtDollar(risk.var95) },
    { label: 'VaR (99%)', value: fmtDollar(risk.var99) },
    { label: 'Expected Shortfall', value: fmtDollar(risk.expectedShortfall) },
    { label: 'Worst Historical', value: fmtDollar(risk.worstHistoricalLoss) },
    { label: 'Stress Test', value: fmtDollar(risk.stressTestLoss) },
    { label: 'Kelly Utilization', value: `${risk.kellyUtilization}%` },
  ]

  return (
    <div className="pf-glass-card">
      <div className="pf-glass-card__title">Risk Dashboard</div>
      <div className="pf-risk-rows">
        {rows.map(row => (
          <div key={row.label} className={`pf-risk-row ${row.warn ? 'pf-risk-row--warn' : ''}`}>
            <span className="pf-risk-row__label">{row.label}</span>
            <span className="pf-risk-row__value">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
