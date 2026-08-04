# SPEC-007: QuantStation — Portfolio Real-Time Risk Management Cockpit

| Field         | Value                            |
|:--------------|:---------------------------------|
| **Status**    | Draft                            |
| **Author**    | QuantStation Team                |
| **Created**   | 2026-08-03                       |
| **Updated**   | 2026-08-03                       |
| **Platform**  | macOS / Apple Silicon (Mac Studio)|

---

## 1. Overview

A professional trader's Portfolio page is not just a list of positions — it is a **real-time risk management cockpit**. Professional traders spend more time managing **risk, exposure, and capital allocation** than searching for new trades.

This spec defines a dedicated Portfolio window designed for hedge funds, proprietary trading firms, and institutional trading desks. It combines real-time execution data with portfolio analytics, risk management, and predictive insights in a single operational dashboard.

### 1.1 Design Goals

1. **Portfolio-first** — Always show aggregate risk and capital before individual positions.
2. **Exception-driven** — Surface positions requiring attention (high risk, breached stops, concentration, regime changes) ahead of healthy positions.
3. **Drill-down workflow** — Every metric should be clickable, allowing users to move from portfolio → sector → symbol → execution history → journal.
4. **Configurable layouts** — Let traders create saved views (e.g., "Scalping", "Swing", "Options", "Risk Review") with different column sets.
5. **Streaming updates** — P&L, exposures, AI scores, and alerts update continuously, while expensive analytics (correlation matrices, stress tests) refresh on configurable intervals.
6. **Decision-making focus** — Emphasize actionable insights rather than simply displaying data.

### 1.2 Design Aesthetic — "007 Cockpit"

- Dark glassmorphic panels with subtle `backdrop-filter: blur()` and glass borders
- Gold accent color (`hsl(45, 85%, 55%)`) for premium feel
- Animated SVG risk gauges with `stroke-dashoffset` animation
- Pulsing data points on real-time updates
- Micro-animations for hover, sort, and state transitions
- Monospace tabular numerics for all financial data

---

## 2. Window Layout

The Portfolio Cockpit occupies its own dedicated Electron `BrowserWindow`, designed for display at 1920×1080 minimum resolution. It is accessible via `View → Portfolio (Cmd+4)`.

```
+===========================================================================================================+
| PORTFOLIO                                              Net Liq: $2,435,782   P&L: +42,350 (+1.77%)        |
+===========================================================================================================+
| Summary | Positions | Risk | Exposure | Attribution | AI Health | Orders | Alerts                        |
+===========================================================================================================+

+----------------------+-----------------------------+-----------------------------------------+
| Account Summary      | Today's P&L                | Risk Gauge                              |
|----------------------|-----------------------------|-----------------------------------------|
| Net Liquidation      | Realized                   | ████████░░  Medium (82%)                |
| Cash / Buying Power  | Unrealized                 | VaR (95%): -$48,200                     |
| Margin Used/Remain   | Gross/Net Exposure         | Expected Drawdown                       |
| Portfolio Value      | Commissions                | Kill Switch Status: Armed               |
+----------------------+-----------------------------+-----------------------------------------+

+---------------------------------------------------------------------------------------------+
| Open Positions (sortable, 19 columns)                                                       |
| SYM  Qty  Avg  Last  MktVal  P&L  Unreal  Risk%  Alloc%  Stop  AI  Regime  Alert           |
+---------------------------------------------------------------------------------------------+

+------------------+------------------+-------------------------------+
| Risk Dashboard   | Market Exposure  | AI Recommendations            |
|  Greeks          |  Long $1.8M      |  ✓ Reduce Tech Exposure       |
|  VaR / ES        |  Short $600K     |  ✓ Tighten Stops on AMD       |
|  Stress Tests    |  Net $1.2M       |  ✓ Hedge with SPY puts        |
|  Kelly / Budget  |  Beta-Adj $980K  |  ✓ Portfolio beta above target|
+------------------+------------------+-------------------------------+

+------------------+------------------+-------------------------------+
| Sector Exposure  | Strategy Alloc   | Position Risk Ranking         |
|  Tech 38%        |  Momentum 42%    |  #1 AMD — Risk 94 ⚠️          |
|  Finl 18%        |  Swing 28%       |  #2 PLTR — Risk 82            |
|  Hlth 12%        |  Mean Rev 18%    |  #3 NVDA — Risk 80            |
|  Engy 8%         |  Scalp 12%       |                               |
+------------------+------------------+-------------------------------+

+-------------------------------+--------------------------------------+
| AI Position Health            | Performance Attribution              |
|  PLTR ★★★★★ Momentum ↑       |  By Sector: Tech +4500, Hlth -800   |
|  NVDA ★★★★☆ Stable           |  By Strategy: Mom +5200, Swing +1400|
|  AMD  ★★☆☆☆ Exit Warning ⚠️   |  By Model: AI +3800, Manual +1200   |
+-------------------------------+--------------------------------------+

+-------------------------------+--------------------------------------+
| Open Orders                   | Alerts & Timeline                    |
|  Pending / Stop / Limit       |  09:35 Bought PLTR                   |
|  Trailing / Bracket           |  10:14 Risk Alert                    |
+-------------------------------+--------------------------------------+
```

### 2.1 Panel Dimensions

| Panel | Size | Description |
|:------|:-----|:------------|
| Title Bar | 40px fixed | Custom titlebar with Net Liq, P&L, connection status |
| Tab Navigation | 36px fixed, sticky | Quick-jump navigation to sections |
| KPI Strip | ~120px | 3-column: Account Summary, Today's P&L, Risk Gauge |
| Position Grid | ~300px min | Full-width sortable data table, variable height |
| Analytics Row 1 | ~260px | Risk Dashboard, Market Exposure, AI Recommendations |
| Analytics Row 2 | ~240px | Sector Exposure, Strategy Allocation, Position Risk Ranking |
| Analytics Row 3 | ~220px | AI Position Health, Performance Attribution |
| Bottom Row | ~200px | Open Orders, Alerts & Timeline |

---

## 3. Top KPI Bar

Always visible at the top of the page.

```
Net Liq | Daily P&L | Unrealized | Realized | Buying Power | Margin | VaR | Drawdown | Win Rate
```

---

## 4. Account Summary

| Metric | Description |
|:-------|:------------|
| Net Liquidation | Total portfolio value |
| Cash | Available cash |
| Buying Power | Remaining purchasing power |
| Margin Remaining | Unused margin |
| Portfolio Value | Market value of all positions |
| Today's Return | Daily return % |
| YTD Return | Year-to-date return % |
| Realized P&L | Closed trade profits |
| Unrealized P&L | Open position profits |
| Commissions | Today's trading costs |
| Borrow Fees | Short selling costs |
| Interest | Margin interest |

Professional traders want **capital efficiency**, not just profits.

---

## 5. Position Grid

The heart of the page. A full-width sortable data table.

| Column | Purpose |
|:-------|:--------|
| Symbol | Ticker |
| Qty | Shares/contracts |
| Avg Cost | Entry price |
| Last | Current price |
| Market Value | Position size in $ |
| Today's P&L | Daily profit/loss |
| Unrealized | Lifetime unrealized P&L |
| Realized | Closed portion P&L |
| Risk % | Portfolio risk contribution |
| Allocation % | Portfolio weight |
| Stop | Active stop-loss price |
| Target | Target exit price |
| R-Multiple | Current risk multiple |
| Holding Time | Duration held |
| Strategy | Swing / Momentum / Mean Reversion |
| AI Score | Current model score (0–100) |
| Confidence | AI probability estimate |
| HMM Regime | Current market regime (Bull / Neutral / Bear) |
| Alert | Warning indicator |

---

## 6. Risk Dashboard

Where professionals spend most of their attention.

| Metric | Description |
|:-------|:------------|
| Portfolio Beta | Market sensitivity |
| Portfolio Delta | Directional exposure |
| Portfolio Gamma | Rate of delta change |
| Portfolio Vega | Volatility sensitivity |
| Portfolio Theta | Time decay |
| Portfolio Correlation | Average cross-correlation |
| VaR (95%) | Value at Risk — 95% confidence |
| VaR (99%) | Value at Risk — 99% confidence |
| Expected Shortfall | Conditional VaR |
| Worst Historical Loss | Maximum historical drawdown |
| Stress Test Loss | Simulated stress scenario |
| Kelly Utilization | Kelly criterion usage % |
| Risk Budget Used | Animated gauge (target ≤ 85%) |

---

## 7. Sector Exposure

CSS conic-gradient donut chart with interactive legend.

| Sector | Example |
|:-------|:--------|
| Technology | 38% |
| Financial | 18% |
| Healthcare | 12% |
| Energy | 8% |
| Consumer | 7% |
| Cash | 17% |

---

## 8. Strategy Allocation

Horizontal bar chart showing allocation by trading strategy.

| Strategy | Example |
|:---------|:--------|
| Momentum | 42% |
| Swing | 28% |
| Mean Reversion | 18% |
| Scalping | 12% |

---

## 9. Market Exposure

| Metric | Example |
|:-------|:--------|
| Long Exposure | $1.8M |
| Short Exposure | $600K |
| Net Exposure | $1.2M |
| Gross Exposure | $2.4M |
| Beta Adjusted Exposure | $980K |

---

## 10. Correlation Matrix (Phase 2)

Heatmap table of position-to-position correlations, highlighting concentration risk.

---

## 11. Performance Attribution

Where did today's profit come from?

### By Sector
```
Technology   +$4,500
Healthcare   -$800
Energy       +$200
Financial    +$1,200
```

### By Strategy
```
Momentum     +$5,200
Swing        +$1,400
Scalping     -$600
```

### By Model
```
AI Signals   +$3,800
Manual       +$1,200
```

---

## 12. Position Risk Ranking

Sorted by risk score (highest first).

```
#1  AMD   Risk 94  ⚠️  High volatility, negative news, support nearby
#2  PLTR  Risk 82      Overweight, earnings approaching
#3  NVDA  Risk 80      Sector concentration
```

---

## 13. AI Position Health

Per-position health assessment with star ratings.

```
PLTR  ★★★★★  Momentum Increasing   → Strong Buy
NVDA  ★★★★☆  Stable                → Hold
AMD   ★★☆☆☆  Exit Warning          → Reduce
```

Health states: Healthy | Weakening | Breaking Down | Recovering | Strong Buy | Reduce | Exit

---

## 14. Open Orders

| Column | Purpose |
|:-------|:--------|
| Symbol | Ticker |
| Side | BUY / SELL |
| Type | LIMIT / STOP / TRAILING / BRACKET |
| Qty | Order quantity |
| Price | Limit/stop price |
| Status | PENDING / SUBMITTED / PARTIAL |
| Time | Order creation time |

---

## 15. Alerts Feed

Real-time alerts with severity levels:

- 🔴 Position exceeds risk budget
- 🔴 Stop triggered
- 🟡 Portfolio beta too high
- 🟡 Sector overweight
- 🟡 AI downgrade
- 🔵 HMM regime changed
- 🔵 Options expiration approaching
- 🔵 Earnings tomorrow
- ⚪ Correlation spike

---

## 16. AI Recommendations

Actionable insights displayed as checklist items:

```
✓ Reduce Tech Exposure (38% → target 30%)
✓ Add Energy Hedge
✓ Tighten Stops on AMD (Risk 94)
✓ PLTR nearing target ($128.50)
✓ Hedge with SPY puts (beta 1.3 → target 1.0)
✓ Correlation exceeding threshold (Tech cluster: 0.86)
✓ Portfolio beta above target (1.3 vs 1.0)
```

---

## 17. Activity Timeline

Chronological trade activity log:

```
09:35  Bought PLTR 1000 @ 120.30
10:14  Reduced NVDA 200 → 150
11:20  Risk Alert: AMD breached stop
12:02  Stop Updated: AMD 146.30 → 145.00
14:10  Closed AMD -500
15:41  New High Water Mark: $2,435,782
```

---

## 18. Architecture

```
Portfolio Cockpit
│
├── Account Summary (KPI strip)
├── Position Grid (sortable table)
├── Risk Dashboard
│     ├── Greeks (Beta, Delta, Gamma, Vega, Theta)
│     ├── VaR / Expected Shortfall
│     ├── Stress Tests
│     └── Risk Budget Gauge
│
├── Exposure
│     ├── Sector (donut chart)
│     ├── Strategy (bar chart)
│     └── Market (Long/Short/Net/Gross)
│
├── Attribution
│     ├── By Sector
│     ├── By Strategy
│     └── By Model (AI vs Manual)
│
├── AI & Risk
│     ├── Position Health (star ratings)
│     ├── Position Risk Ranking
│     └── AI Recommendations
│
├── Orders & Activity
│     ├── Open Orders
│     ├── Alerts Feed
│     └── Activity Timeline
│
└── Phase 2 (deferred)
      ├── Correlation Matrix
      ├── Trade Journal
      ├── Full Performance Analytics
      ├── Configurable Layout Views
      └── Exposure Heatmap (cap/style)
```

---

## 19. Technical Implementation

### 19.1 Electron Window

- New `BrowserWindow` with hash route `#/portfolio`
- View menu: `Portfolio (Cmd+4)`
- Window state persistence (show/hide remembered)
- Window dimensions: 1920×1080 default, 1280×720 minimum

### 19.2 Component Structure

All components under `src/components/portfolio/`:

| File | Component |
|:-----|:----------|
| `PortfolioCockpit.tsx` | Root page layout |
| `AccountSummary.tsx` | KPI strip |
| `PositionGrid.tsx` | Position table |
| `RiskDashboard.tsx` | Risk metrics & gauge |
| `SectorExposure.tsx` | Donut chart |
| `StrategyAllocation.tsx` | Bar chart |
| `MarketExposure.tsx` | Exposure cards |
| `PositionRiskRanking.tsx` | Risk cards |
| `AIPositionHealth.tsx` | Health cards |
| `PerformanceAttribution.tsx` | Attribution panels |
| `OpenOrders.tsx` | Orders table |
| `AlertsFeed.tsx` | Alert items |
| `AIRecommendations.tsx` | Recommendation list |
| `ActivityTimeline.tsx` | Timeline |
| `types.ts` | TypeScript interfaces |
| `mockData.ts` | Realistic mock data |
| `usePortfolioData.ts` | Data hook (mock → live swap) |

### 19.3 Data Strategy

- Phase 1: Mock data via `usePortfolioData` hook
- Phase 2: Connect to Spring Boot WebSocket topics (`/topic/portfolio/*`)
- Hook interface remains stable — components never change

### 19.4 CSS

- BEM classes prefixed with `.pf-` (portfolio)
- All styles in `src/index.css` using existing `--qs-*` design tokens
- New accent token: `--qs-gold: hsl(45, 85%, 55%)` for premium feel
