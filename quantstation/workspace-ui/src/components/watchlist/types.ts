// ═══════════════════════════════════════════════════════
// QuantStation — Multi-Watchlist Command Center Types
// ═══════════════════════════════════════════════════════

export type CategoryId =
  | 'manual'
  | 'composite'
  | 'momentum'
  | 'gap_up'
  | 'gap_down'
  | 'breakout_up'
  | 'breakdown'
  | 'rvol'
  | 'options'
  | 'earnings'
  | 'ai_quant'
  | 'technical'
  | 'news'
  | 'institutional'
  | 'sector_rotation'
  | 'swing'
  | 'scalping'
  | 'favorites'

export type ColumnFormat = 'text' | 'price' | 'percent' | 'volume' | 'ratio' | 'number' | 'action'
export type SortDirection = 'asc' | 'desc'
export type AlertState = 'APPROACHING' | 'TRIGGERED' | 'CONFIRMED' | 'EXPIRED' | 'NONE'

export interface ConditionalFormatRule {
  condition: 'gt' | 'lt' | 'gte' | 'lte' | 'eq'
  value: number
  color?: string       // CSS color or variable reference
  fontWeight?: string
  background?: string
  animation?: string   // CSS animation name
}

export interface ColumnDef {
  key: string
  label: string
  width: number
  align: 'left' | 'right' | 'center'
  format: ColumnFormat
  pinned?: boolean
  sortable?: boolean
  conditionalFormat?: ConditionalFormatRule[]
}

export interface CategoryConfig {
  id: CategoryId
  label: string
  icon: string
  description: string
  columns: ColumnDef[]
  allowManualAdd: boolean
  sortDefault: { column: string; direction: SortDirection }
  phase: 1 | 2 | 3 | 4   // Which implementation phase enables this category
}

// ── Core symbol data model ─────────────────────────────

export interface WatchlistSymbol {
  // Identity
  symbol: string
  companyName: string
  sector: string
  industry: string

  // Live Market Data (from WebSocket tick stream)
  price: number
  prevClose: number
  changePercent: number
  volume: number
  rvol: number
  bidPrice: number
  askPrice: number
  spread: number   // absolute spread (ask - bid)

  // Reference Data (seeded on add, periodically refreshed)
  atr: number
  avgVolume?: number     // 20-day average daily volume (shares)
  float: number          // shares float (raw number)
  marketCap: number      // market cap (raw number)
  beta: number
  shortFloatPercent: number
  borrowRate: number

  // Computed / AI-Driven (Phase 2+)
  overallScore: number     // 0–100
  tradeGrade: string       // A+, A, B+, B, C, --
  alertState: AlertState

  // Metadata
  categories: CategoryId[]
  addedAt: number          // unix ms timestamp
  notes: string            // user notes (Manual category)
  tags: string[]           // user color tags
}

// ── Store state types ──────────────────────────────────

export interface WatchlistSortState {
  column: string
  direction: SortDirection
}
