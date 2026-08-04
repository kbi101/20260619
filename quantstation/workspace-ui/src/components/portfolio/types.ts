// ═══════════════════════════════════════════════════════
// QuantStation — Portfolio Cockpit Types (SPEC-007)
// ═══════════════════════════════════════════════════════

/** Trading strategy classification */
export type TradingStrategy = 'Momentum' | 'Swing' | 'Mean Reversion' | 'Scalping' | 'Pairs' | 'Options' | 'Income' | 'Long-term'

/** HMM market regime */
export type MarketRegime = 'Bull' | 'Neutral' | 'Bear'

/** AI-derived position health state */
export type HealthState = 'Healthy' | 'Weakening' | 'Breaking Down' | 'Recovering' | 'Strong Buy' | 'Reduce' | 'Exit'

/** Alert severity level */
export type AlertSeverity = 'critical' | 'warning' | 'info' | 'low'

/** Alert category */
export type AlertCategory =
  | 'risk_budget'
  | 'stop_triggered'
  | 'beta_high'
  | 'sector_overweight'
  | 'ai_downgrade'
  | 'regime_change'
  | 'options_expiry'
  | 'earnings'
  | 'correlation_spike'

// ── Account Summary ────────────────────────────────────

export interface AccountSummaryData {
  netLiquidation: number
  cash: number
  buyingPower: number
  marginRemaining: number
  portfolioValue: number
  todayReturn: number       // percentage
  ytdReturn: number         // percentage
  realizedPnl: number
  unrealizedPnl: number
  totalPnl: number
  commissions: number
  borrowFees: number
  interest: number
  grossExposure: number
  netExposure: number
}

// ── Position ───────────────────────────────────────────

export interface PortfolioPosition {
  symbol: string
  companyName: string
  sector: string
  quantity: number
  avgCost: number
  lastPrice: number
  marketValue: number
  todayPnl: number
  unrealizedPnl: number
  realizedPnl: number
  riskPercent: number       // portfolio risk contribution %
  allocationPercent: number // portfolio weight %
  stopPrice: number | null
  targetPrice: number | null
  rMultiple: number
  holdingDays: number
  strategy: TradingStrategy
  aiScore: number           // 0–100
  confidence: number        // 0–100
  hmmRegime: MarketRegime
  alertLevel: AlertSeverity | null
  alertMessage: string | null
}

// ── Risk Metrics ───────────────────────────────────────

export interface RiskMetrics {
  portfolioBeta: number
  portfolioDelta: number
  portfolioGamma: number
  portfolioVega: number
  portfolioTheta: number
  portfolioCorrelation: number
  var95: number             // Value at Risk 95%
  var99: number             // Value at Risk 99%
  expectedShortfall: number
  worstHistoricalLoss: number
  stressTestLoss: number
  kellyUtilization: number  // percentage
  riskBudgetUsed: number    // percentage
}

// ── Sector Exposure ────────────────────────────────────

export interface SectorExposureItem {
  sector: string
  percentage: number
  value: number
  color: string             // CSS color
}

// ── Strategy Allocation ────────────────────────────────

export interface StrategyAllocationItem {
  strategy: TradingStrategy
  percentage: number
  value: number
  color: string
}

// ── Market Exposure ────────────────────────────────────

export interface MarketExposureData {
  longExposure: number
  shortExposure: number
  netExposure: number
  grossExposure: number
  betaAdjustedExposure: number
}

// ── Position Risk Ranking ──────────────────────────────

export interface PositionRisk {
  symbol: string
  riskScore: number         // 0–100
  reasons: string[]
  severity: AlertSeverity
}

// ── AI Position Health ─────────────────────────────────

export interface AIHealthItem {
  symbol: string
  stars: number             // 1–5
  state: HealthState
  trend: string             // e.g. "Momentum Increasing", "Stable", "Exit Warning"
  momentumDirection: 'up' | 'down' | 'flat'
}

// ── Performance Attribution ────────────────────────────

export interface AttributionItem {
  name: string
  pnl: number
}

export interface PerformanceAttributionData {
  bySector: AttributionItem[]
  byStrategy: AttributionItem[]
  byModel: AttributionItem[]
}

// ── Open Orders ────────────────────────────────────────

export type PortfolioOrderType = 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TRAILING' | 'BRACKET' | 'MARKET'
export type PortfolioOrderStatus = 'PENDING' | 'SUBMITTED' | 'PARTIAL'

export interface PortfolioOrder {
  orderId: string
  symbol: string
  side: 'BUY' | 'SELL'
  orderType: PortfolioOrderType
  quantity: number
  price: number
  status: PortfolioOrderStatus
  createdAt: string         // ISO timestamp
}

// ── Alerts ─────────────────────────────────────────────

export interface PortfolioAlert {
  id: string
  severity: AlertSeverity
  category: AlertCategory
  message: string
  timestamp: string         // ISO timestamp
  symbol?: string
}

// ── AI Recommendations ─────────────────────────────────

export interface AIRecommendation {
  id: string
  text: string
  priority: 'high' | 'medium' | 'low'
  completed: boolean
}

// ── Activity Timeline ──────────────────────────────────

export type TimelineEventType = 'trade' | 'alert' | 'update' | 'milestone'

export interface TimelineEvent {
  id: string
  time: string              // HH:MM format
  type: TimelineEventType
  message: string
  symbol?: string
}

// ── Aggregate Data Bundle ──────────────────────────────

export interface PortfolioData {
  account: AccountSummaryData
  positions: PortfolioPosition[]
  risk: RiskMetrics
  sectorExposure: SectorExposureItem[]
  strategyAllocation: StrategyAllocationItem[]
  marketExposure: MarketExposureData
  positionRisks: PositionRisk[]
  aiHealth: AIHealthItem[]
  attribution: PerformanceAttributionData
  openOrders: PortfolioOrder[]
  alerts: PortfolioAlert[]
  recommendations: AIRecommendation[]
  timeline: TimelineEvent[]
}
