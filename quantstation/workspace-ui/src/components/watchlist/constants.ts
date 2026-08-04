// ═══════════════════════════════════════════════════════
// QuantStation — Watchlist Category Definitions
// ═══════════════════════════════════════════════════════
// Defines all 17 watchlist categories with their column sets.
// Phase 1: only 'manual' and 'favorites' have live symbol data.
// All other categories show a placeholder until their phase ships.

import type { CategoryConfig, CategoryId, ColumnDef } from './types'

// ── Shared base columns (appear in most categories) ───

const COL_SYMBOL: ColumnDef = {
  key: 'symbol',
  label: 'Symbol',
  width: 72,
  align: 'left',
  format: 'text',
  pinned: true,
  sortable: true,
}

const COL_PRICE: ColumnDef = {
  key: 'price',
  label: 'Last',
  width: 80,
  align: 'right',
  format: 'price',
  pinned: true,
  sortable: true,
}

const COL_CHANGE_PCT: ColumnDef = {
  key: 'changePercent',
  label: 'Chg %',
  width: 70,
  align: 'right',
  format: 'percent',
  pinned: true,
  sortable: true,
  conditionalFormat: [
    { condition: 'gte', value: 5, color: 'var(--qs-green)', fontWeight: 'bold' },
    { condition: 'gt', value: 0, color: 'var(--qs-green)' },
    { condition: 'lte', value: -5, color: 'var(--qs-red)', fontWeight: 'bold' },
    { condition: 'lt', value: 0, color: 'var(--qs-red)' },
  ],
}

const COL_VOLUME: ColumnDef = {
  key: 'volume',
  label: 'Volume',
  width: 90,
  align: 'right',
  format: 'volume',
  sortable: true,
}

const COL_RVOL: ColumnDef = {
  key: 'rvol',
  label: 'RVOL',
  width: 60,
  align: 'right',
  format: 'ratio',
  sortable: true,
  conditionalFormat: [
    { condition: 'gte', value: 5, color: 'var(--qs-amber)', fontWeight: 'bold', animation: 'wl-pulse' },
    { condition: 'gte', value: 3, color: 'var(--qs-amber)', fontWeight: 'bold' },
  ],
}

const COL_ATR: ColumnDef = {
  key: 'atr',
  label: 'ATR',
  width: 60,
  align: 'right',
  format: 'price',
  sortable: true,
}

const COL_SPREAD: ColumnDef = {
  key: 'spread',
  label: 'Spread',
  width: 68,
  align: 'right',
  format: 'price',
  sortable: true,
  conditionalFormat: [
    { condition: 'lte', value: 0.05, color: 'var(--qs-green)' },
    { condition: 'gte', value: 0.5, color: 'var(--qs-red)' },
  ],
}

const COL_FLOAT: ColumnDef = {
  key: 'float',
  label: 'Float',
  width: 80,
  align: 'right',
  format: 'volume',
  sortable: true,
}

const COL_MARKET_CAP: ColumnDef = {
  key: 'marketCap',
  label: 'Mkt Cap',
  width: 90,
  align: 'right',
  format: 'volume',
  sortable: true,
}

const COL_NOTES: ColumnDef = {
  key: 'notes',
  label: 'Notes',
  width: 160,
  align: 'left',
  format: 'text',
  sortable: false,
}

const COL_REMOVE: ColumnDef = {
  key: '__remove',
  label: '',
  width: 28,
  align: 'center',
  format: 'action',
  sortable: false,
}

// ── Base columns shared by Manual and Favorites ────────

const BASE_MANUAL_COLS: ColumnDef[] = [
  COL_SYMBOL,
  COL_PRICE,
  COL_CHANGE_PCT,
  COL_VOLUME,
  COL_RVOL,
  COL_ATR,
  COL_SPREAD,
  COL_FLOAT,
  COL_MARKET_CAP,
  COL_NOTES,
  COL_REMOVE,
]

const BASE_FAVORITES_COLS: ColumnDef[] = [
  COL_SYMBOL,
  COL_PRICE,
  COL_CHANGE_PCT,
  COL_VOLUME,
  COL_RVOL,
  COL_ATR,
  COL_SPREAD,
  COL_FLOAT,
  COL_MARKET_CAP,
  COL_REMOVE,
]

// ── Composite columns (Phase 2+) ──────────────────────

const COMPOSITE_COLS: ColumnDef[] = [
  { key: 'rank', label: '#', width: 36, align: 'center', format: 'number', pinned: true, sortable: true },
  COL_SYMBOL,
  { key: 'overallScore', label: 'Score', width: 64, align: 'right', format: 'number', sortable: true },
  { key: 'primarySetup', label: 'Primary Setup', width: 140, align: 'left', format: 'text', sortable: false },
  COL_PRICE,
  COL_CHANGE_PCT,
  COL_RVOL,
  { key: 'aiScore', label: 'AI Score', width: 72, align: 'right', format: 'number', sortable: true },
  { key: 'tradeGrade', label: 'Grade', width: 56, align: 'center', format: 'text', sortable: true },
  { key: 'alertState', label: 'Alert', width: 84, align: 'center', format: 'text', sortable: true },
]

// ── All category definitions ───────────────────────────

export const CATEGORIES: CategoryConfig[] = [
  {
    id: 'manual',
    label: 'Manual',
    icon: '📝',
    description: 'Ad-hoc scratchpad — manually added symbols for the current session',
    columns: BASE_MANUAL_COLS,
    allowManualAdd: true,
    sortDefault: { column: 'changePercent', direction: 'desc' },
    phase: 1,
  },
  {
    id: 'favorites',
    label: 'Favorites',
    icon: '❤️',
    description: 'Curated personal watchlist — persisted across sessions',
    columns: BASE_FAVORITES_COLS,
    allowManualAdd: true,
    sortDefault: { column: 'changePercent', direction: 'desc' },
    phase: 1,
  },
  {
    id: 'composite',
    label: 'Top Picks',
    icon: '⭐',
    description: 'Composite Opportunity Matrix — AI-ranked best opportunities across all categories',
    columns: COMPOSITE_COLS,
    allowManualAdd: false,
    sortDefault: { column: 'overallScore', direction: 'desc' },
    phase: 2,
  },
  {
    id: 'momentum',
    label: 'Momentum',
    icon: '🔥',
    description: 'Stocks already moving with strong directional momentum',
    columns: [
      COL_SYMBOL, COL_PRICE, COL_CHANGE_PCT, COL_RVOL, COL_VOLUME, COL_FLOAT,
      { key: 'vwapDistance', label: 'VWAP Dist', width: 80, align: 'right', format: 'percent', sortable: true },
      { key: 'hod', label: 'HOD', width: 72, align: 'right', format: 'price', sortable: true },
      { key: 'lod', label: 'LOD', width: 72, align: 'right', format: 'price', sortable: true },
      { key: 'momentumScore', label: 'Momentum', width: 80, align: 'right', format: 'number', sortable: true },
    ],
    allowManualAdd: false,
    sortDefault: { column: 'momentumScore', direction: 'desc' },
    phase: 2,
  },
  {
    id: 'gap_up',
    label: 'Gap Up',
    icon: '💰',
    description: 'Pre-market and opening gap-up candidates',
    columns: [
      COL_SYMBOL, COL_PRICE, COL_CHANGE_PCT,
      { key: 'gapPercent', label: 'Gap %', width: 68, align: 'right', format: 'percent', sortable: true },
      { key: 'premarketVolume', label: 'PM Vol', width: 80, align: 'right', format: 'volume', sortable: true },
      { key: 'premarketHigh', label: 'PM High', width: 72, align: 'right', format: 'price', sortable: true },
      COL_FLOAT, COL_ATR,
      { key: 'catalyst', label: 'Catalyst', width: 100, align: 'left', format: 'text', sortable: false },
    ],
    allowManualAdd: false,
    sortDefault: { column: 'gapPercent', direction: 'desc' },
    phase: 2,
  },
  {
    id: 'gap_down',
    label: 'Gap Down',
    icon: '📉',
    description: 'Mean reversion, short selling, and dead-cat bounce candidates',
    columns: [
      COL_SYMBOL, COL_PRICE, COL_CHANGE_PCT,
      { key: 'gapPercent', label: 'Gap %', width: 68, align: 'right', format: 'percent', sortable: true },
      { key: 'support', label: 'Support', width: 72, align: 'right', format: 'price', sortable: true },
      { key: 'shortPercent', label: 'Short %', width: 68, align: 'right', format: 'percent', sortable: true },
      COL_FLOAT, COL_RVOL,
      { key: 'borrowRate', label: 'Borrow', width: 68, align: 'right', format: 'percent', sortable: true },
    ],
    allowManualAdd: false,
    sortDefault: { column: 'gapPercent', direction: 'asc' },
    phase: 2,
  },
  {
    id: 'breakout_up',
    label: 'Breakout ↑',
    icon: '📈',
    description: 'Symbols approaching or breaking key resistance levels',
    columns: [
      COL_SYMBOL, COL_PRICE, COL_CHANGE_PCT,
      { key: 'resistance', label: 'Resistance', width: 80, align: 'right', format: 'price', sortable: true },
      { key: 'distToResistance', label: 'Dist %', width: 64, align: 'right', format: 'percent', sortable: true },
      { key: 'breakoutScore', label: 'BKO Score', width: 80, align: 'right', format: 'number', sortable: true },
      COL_RVOL,
      { key: 'adx', label: 'ADX', width: 52, align: 'right', format: 'number', sortable: true },
      { key: 'rsi', label: 'RSI', width: 52, align: 'right', format: 'number', sortable: true },
    ],
    allowManualAdd: false,
    sortDefault: { column: 'breakoutScore', direction: 'desc' },
    phase: 2,
  },
  {
    id: 'breakdown',
    label: 'Breakdown ↓',
    icon: '📉',
    description: 'Symbols approaching or breaking key support levels',
    columns: [
      COL_SYMBOL, COL_PRICE, COL_CHANGE_PCT,
      { key: 'support', label: 'Support', width: 72, align: 'right', format: 'price', sortable: true },
      { key: 'distToSupport', label: 'Dist %', width: 64, align: 'right', format: 'percent', sortable: true },
      { key: 'bearScore', label: 'Bear Score', width: 80, align: 'right', format: 'number', sortable: true },
      COL_RVOL,
      { key: 'rsi', label: 'RSI', width: 52, align: 'right', format: 'number', sortable: true },
    ],
    allowManualAdd: false,
    sortDefault: { column: 'bearScore', direction: 'desc' },
    phase: 2,
  },
  {
    id: 'rvol',
    label: 'Hi-RVOL',
    icon: '⚡',
    description: 'Volume-driven screening for unusual activity',
    columns: [
      COL_SYMBOL, COL_PRICE, COL_CHANGE_PCT, COL_RVOL, COL_VOLUME,
      { key: 'avgVolume', label: 'Avg Vol', width: 80, align: 'right', format: 'volume', sortable: true },
      { key: 'volumeSpikePct', label: 'Spike %', width: 68, align: 'right', format: 'percent', sortable: true },
      { key: 'blockTrades', label: 'Blocks', width: 60, align: 'right', format: 'number', sortable: true },
      { key: 'darkPoolPct', label: 'Dark%', width: 60, align: 'right', format: 'percent', sortable: true },
    ],
    allowManualAdd: false,
    sortDefault: { column: 'rvol', direction: 'desc' },
    phase: 2,
  },
  {
    id: 'options',
    label: 'Options',
    icon: '🎯',
    description: 'Unusual options flow and positioning',
    columns: [
      COL_SYMBOL, COL_PRICE, COL_CHANGE_PCT,
      { key: 'optionVolume', label: 'Opt Vol', width: 80, align: 'right', format: 'volume', sortable: true },
      { key: 'callPutRatio', label: 'C/P Ratio', width: 72, align: 'right', format: 'ratio', sortable: true },
      { key: 'ivRank', label: 'IV Rank', width: 64, align: 'right', format: 'percent', sortable: true },
      { key: 'unusualOptions', label: 'Unusual', width: 64, align: 'center', format: 'text', sortable: true },
      { key: 'maxPain', label: 'Max Pain', width: 72, align: 'right', format: 'price', sortable: true },
      { key: 'expectedMove', label: 'Exp Move', width: 76, align: 'right', format: 'price', sortable: true },
    ],
    allowManualAdd: false,
    sortDefault: { column: 'optionVolume', direction: 'desc' },
    phase: 4,
  },
  {
    id: 'earnings',
    label: 'Earnings',
    icon: '📅',
    description: 'Symbols with upcoming or recent earnings events',
    columns: [
      COL_SYMBOL, COL_PRICE, COL_CHANGE_PCT,
      { key: 'daysToEarnings', label: 'Days', width: 52, align: 'right', format: 'number', sortable: true },
      { key: 'epsEstimate', label: 'EPS Est', width: 68, align: 'right', format: 'price', sortable: true },
      { key: 'whisperNumber', label: 'Whisper', width: 72, align: 'right', format: 'price', sortable: true },
      { key: 'historicalMove', label: 'Hist Move', width: 76, align: 'right', format: 'percent', sortable: true },
      { key: 'ivCrush', label: 'IV Crush', width: 68, align: 'right', format: 'percent', sortable: true },
    ],
    allowManualAdd: false,
    sortDefault: { column: 'daysToEarnings', direction: 'asc' },
    phase: 3,
  },
  {
    id: 'ai_quant',
    label: 'AI Signals',
    icon: '🧠',
    description: 'Generated by QuantStation engine — HMM, ML probability models',
    columns: [
      COL_SYMBOL, COL_PRICE, COL_CHANGE_PCT,
      { key: 'hmmRegime', label: 'HMM Regime', width: 100, align: 'left', format: 'text', sortable: true },
      { key: 'bullProbability', label: 'Bull %', width: 64, align: 'right', format: 'percent', sortable: true },
      { key: 'bearProbability', label: 'Bear %', width: 64, align: 'right', format: 'percent', sortable: true },
      { key: 'expectedReturn', label: 'Exp Ret', width: 68, align: 'right', format: 'percent', sortable: true },
      { key: 'kellyPct', label: 'Kelly %', width: 64, align: 'right', format: 'percent', sortable: true },
      { key: 'winProbability', label: 'Win %', width: 64, align: 'right', format: 'percent', sortable: true },
    ],
    allowManualAdd: false,
    sortDefault: { column: 'bullProbability', direction: 'desc' },
    phase: 3,
  },
  {
    id: 'technical',
    label: 'Technical',
    icon: '📊',
    description: 'Classical technical analysis screening',
    columns: [
      COL_SYMBOL, COL_PRICE, COL_CHANGE_PCT,
      { key: 'ema20', label: 'EMA20', width: 72, align: 'right', format: 'price', sortable: true },
      { key: 'ema50', label: 'EMA50', width: 72, align: 'right', format: 'price', sortable: true },
      { key: 'adx', label: 'ADX', width: 52, align: 'right', format: 'number', sortable: true },
      { key: 'rsi', label: 'RSI', width: 52, align: 'right', format: 'number', sortable: true },
      { key: 'macd', label: 'MACD', width: 72, align: 'right', format: 'number', sortable: true },
      { key: 'vwap', label: 'VWAP', width: 72, align: 'right', format: 'price', sortable: true },
      COL_ATR,
    ],
    allowManualAdd: false,
    sortDefault: { column: 'rsi', direction: 'desc' },
    phase: 2,
  },
  {
    id: 'news',
    label: 'News',
    icon: '📰',
    description: 'NLP-filtered headline-driven screening',
    columns: [
      COL_SYMBOL, COL_PRICE, COL_CHANGE_PCT,
      { key: 'headline', label: 'Headline', width: 260, align: 'left', format: 'text', sortable: false },
      { key: 'newsSentiment', label: 'Sentiment', width: 80, align: 'center', format: 'text', sortable: true },
      { key: 'newsImpact', label: 'Impact', width: 64, align: 'right', format: 'number', sortable: true },
      { key: 'newsSource', label: 'Source', width: 80, align: 'left', format: 'text', sortable: false },
    ],
    allowManualAdd: false,
    sortDefault: { column: 'newsImpact', direction: 'desc' },
    phase: 3,
  },
  {
    id: 'institutional',
    label: 'Institutional',
    icon: '🏛️',
    description: 'Dark pool, block trade, and insider activity screening',
    columns: [
      COL_SYMBOL, COL_PRICE, COL_CHANGE_PCT,
      { key: 'darkPoolPct', label: 'Dark%', width: 60, align: 'right', format: 'percent', sortable: true },
      { key: 'blockTrades', label: 'Blocks', width: 60, align: 'right', format: 'number', sortable: true },
      { key: 'insiderBuying', label: 'Insider Buy', width: 88, align: 'right', format: 'volume', sortable: true },
      { key: 'insiderSelling', label: 'Insider Sell', width: 88, align: 'right', format: 'volume', sortable: true },
      { key: 'smartMoneyScore', label: 'Smart $', width: 68, align: 'right', format: 'number', sortable: true },
    ],
    allowManualAdd: false,
    sortDefault: { column: 'smartMoneyScore', direction: 'desc' },
    phase: 4,
  },
  {
    id: 'sector_rotation',
    label: 'Sectors',
    icon: '🔄',
    description: 'Sector-level relative strength and rotation analysis',
    columns: [
      COL_SYMBOL, COL_PRICE, COL_CHANGE_PCT,
      { key: 'sector', label: 'Sector', width: 120, align: 'left', format: 'text', sortable: true },
      { key: 'sectorRank', label: 'Sect Rank', width: 80, align: 'right', format: 'number', sortable: true },
      { key: 'relativeStrength', label: 'RS Ratio', width: 72, align: 'right', format: 'ratio', sortable: true },
      { key: 'correlationSpy', label: 'Beta/SPY', width: 72, align: 'right', format: 'ratio', sortable: true },
    ],
    allowManualAdd: false,
    sortDefault: { column: 'sectorRank', direction: 'asc' },
    phase: 4,
  },
  {
    id: 'swing',
    label: 'Swing',
    icon: '🎯',
    description: 'Multi-day hold candidates for swing trading',
    columns: [
      COL_SYMBOL, COL_PRICE, COL_CHANGE_PCT,
      { key: 'dailyTrend', label: 'Trend', width: 60, align: 'center', format: 'text', sortable: true },
      { key: 'weeklyRsi', label: 'W-RSI', width: 60, align: 'right', format: 'number', sortable: true },
      { key: 'dailyRsi', label: 'D-RSI', width: 60, align: 'right', format: 'number', sortable: true },
      { key: 'support', label: 'Support', width: 72, align: 'right', format: 'price', sortable: true },
      { key: 'resistance', label: 'Resist', width: 72, align: 'right', format: 'price', sortable: true },
      { key: 'riskReward', label: 'R:R', width: 52, align: 'right', format: 'ratio', sortable: true },
    ],
    allowManualAdd: false,
    sortDefault: { column: 'riskReward', direction: 'desc' },
    phase: 3,
  },
  {
    id: 'scalping',
    label: 'Scalping',
    icon: '⚡',
    description: 'Microstructure data for ultra-fast intraday scalping',
    columns: [
      COL_SYMBOL, COL_PRICE, COL_CHANGE_PCT, COL_SPREAD,
      { key: 'l2Imbalance', label: 'L2 Imbal', width: 76, align: 'right', format: 'ratio', sortable: true },
      { key: 'bidSize', label: 'Bid Sz', width: 64, align: 'right', format: 'volume', sortable: true },
      { key: 'askSize', label: 'Ask Sz', width: 64, align: 'right', format: 'volume', sortable: true },
      { key: 'tapeSpeed', label: 'Tape/s', width: 60, align: 'right', format: 'number', sortable: true },
      { key: 'liquidityScore', label: 'Liquidity', width: 72, align: 'right', format: 'number', sortable: true },
    ],
    allowManualAdd: false,
    sortDefault: { column: 'liquidityScore', direction: 'desc' },
    phase: 4,
  },
]

// ── Lookup helpers ─────────────────────────────────────

export const CATEGORY_MAP: Record<CategoryId, CategoryConfig> = Object.fromEntries(
  CATEGORIES.map(c => [c.id, c])
) as Record<CategoryId, CategoryConfig>

export const DEFAULT_CATEGORY: CategoryId = 'manual'
