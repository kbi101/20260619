# SPEC-006-1: Multi-Watchlist Command Center — Phase 1 Foundation (MVP)

| Field         | Value                            |
|:--------------|:---------------------------------|
| **Status**    | Draft                            |
| **Author**    | QuantStation Team                |
| **Created**   | 2026-08-03                       |
| **Updated**   | 2026-08-03                       |
| **Parent**    | [SPEC-006](006-multi-watchlist-command-center.md) |
| **Platform**  | macOS / Apple Silicon (Mac Studio)|

---

## 1. Scope

Phase 1 replaces the current Intel Dashboard (`IntelDashboard.tsx`, `WatchlistPanel.tsx`, `DailyChecklist.tsx`, etc.) with the new 3-panel Multi-Watchlist layout. The goal is to establish the structural foundation — layout, data flow, and interaction model — without the scoring engine, AI signals, or advanced scanner features (deferred to Phases 2–4).

### 1.1 What's In Scope

- 3-panel layout: Category Sidebar + Symbol Grid + Detail Panel
- All 17 category entries in the sidebar (static definitions, clickable)
- **Manual** category as the default landing view with manual add/remove
- **Favorites** category with manual add/remove and Redis persistence
- Universal base columns rendered in the grid (Symbol, Price, Change %, Volume, RVOL, ATR, Spread, Float, Market Cap)
- Category-specific column sets (client-side column definition switching)
- Detail Panel with symbol header + placeholder sections
- Column sorting (ascending/descending on header click)
- Conditional formatting for Change %, RVOL, Spread
- Cross-window symbol sync via existing `symbol:select` IPC
- Real-time updates from existing WebSocket tick stream
- Electron window config updates (title, size, route, View menu label)

### 1.2 What's Out of Scope (Deferred)

- Composite scoring / ranking engine (Phase 2)
- Filter expression builder (Phase 2)
- Alert lifecycle (Phase 2)
- AI/ML score columns (Phase 3)
- Scanner-based automatic watchlist population (Phase 3)
- Dark pool, institutional flow, unusual options columns (Phase 4)
- Backend REST endpoints for `/api/watchlist/*` (Phase 2)
- New WebSocket topics (`/topic/signals/*`, `/topic/scores/*`) (Phase 2)

---

## 2. Layout Specification

### 2.1 Window Configuration

| Property | Current (`intelWindow`) | Phase 1 Update |
|:---------|:------------------------|:---------------|
| Title | `QuantStation - Intel Dashboard` | `QuantStation — Watchlists` |
| Default Size | 1000 × 800 | 1600 × 1000 |
| Min Size | 800 × 600 | 1200 × 700 |
| Route | `#/intel` | `#/watchlist` |
| Menu Label | `Intel Dashboard` | `Watchlists` |

### 2.2 Three-Panel Layout

```
┌────────────┬──────────────────────────────────────────┬──────────────────┐
│  Category  │              Symbol Grid                 │   Detail Panel   │
│  Sidebar   │                                          │                  │
│  (160px)   │  ┌ Add Symbol Bar ────────────────────┐  │  ┌────────────┐  │
│            │  │ [input] [+ Add]                    │  │  │ NVDA       │  │
│  📝 Manual │  ├────────────────────────────────────┤  │  │ $142.30    │  │
│  ⭐ Top    │  │ SYM   LAST   CHG%  VOL   RVOL ATR │  │  │ +4.2%      │  │
│  🔥 Mom    │  │ NVDA  142.3  +4.2  12M   5.8  4.5 │  │  ├────────────┤  │
│  💰 Gap↑   │  │ PLTR  38.9   +7.3  8.2M  4.9  2.1 │  │  │ ► News     │  │
│  📉 Gap↓   │  │ SOFI  12.4   +3.1  5.1M  3.2  0.8 │  │  │ ► Options  │  │
│  📈 Brk↑   │  │ META  781.2  +1.8  3.4M  2.1  9.2 │  │  │ ► Flow     │  │
│  📉 Brk↓   │  │ AMD   198.7  +2.9  6.8M  3.5  5.1 │  │  │ ► Float    │  │
│  ⚡ RVOL   │  └────────────────────────────────────┘  │  │ ► Sector   │  │
│  🎯 Opt    │                                          │  │ ► Tech     │  │
│  📅 Earn   │                                          │  │ ► AI       │  │
│  🧠 AI     │                                          │  └────────────┘  │
│  📊 Tech   │                                          │                  │
│  📰 News   │                                          │                  │
│  🏛️ Inst   │                                          │                  │
│  🔄 Sect   │                                          │                  │
│  🎯 Swing  │                                          │                  │
│  ⚡ Scalp  │                                          │                  │
│  ❤️ Favs   │                                          │                  │
├────────────┼──────────────────────────────────────────┴──────────────────┤
│            │  📝 Manual │ 8 symbols │ WS: ● Connected │ 09:42:15 EST   │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### 2.3 Panel Behavior

| Panel | Width | Resize | Collapse |
|:------|:------|:-------|:---------|
| Category Sidebar | 160px fixed | No | No |
| Symbol Grid | Flexible, fills remaining | Auto | No |
| Detail Panel | 320px fixed | No | Yes (toggle via button, saves state to localStorage) |

---

## 3. Component Architecture

### 3.1 New Component Tree

```
WatchlistCommandCenter (replaces IntelDashboard)
├── CategorySidebar
│   └── CategoryItem × 17
├── SymbolGrid
│   ├── AddSymbolBar (Manual + Favorites categories only)
│   ├── GridHeader (sortable column headers)
│   └── GridRow × N (virtualized for performance)
├── DetailPanel
│   ├── DetailHeader (symbol, price, change, sparkline)
│   ├── DetailSection: News (placeholder)
│   ├── DetailSection: Options (placeholder)
│   ├── DetailSection: OrderFlow (placeholder)
│   ├── DetailSection: Float (placeholder)
│   ├── DetailSection: Sector (placeholder)
│   ├── DetailSection: Technicals (placeholder)
│   └── DetailSection: AI (placeholder)
├── FilterBar (placeholder — renders but non-functional in Phase 1)
└── StatusBar
```

### 3.2 File Structure

```text
workspace-ui/src/components/watchlist/          # [NEW] directory
├── WatchlistCommandCenter.tsx                   # Root container (replaces IntelDashboard)
├── CategorySidebar.tsx                          # Left sidebar with category navigation
├── SymbolGrid.tsx                               # Central data grid
├── GridHeader.tsx                               # Sortable column headers
├── GridRow.tsx                                  # Single symbol row
├── AddSymbolBar.tsx                             # Manual/Favorites symbol input
├── DetailPanel.tsx                              # Right-side detail panel
├── DetailHeader.tsx                             # Symbol header in detail panel
├── DetailSection.tsx                            # Collapsible accordion section
├── FilterBar.tsx                                # Filter input (placeholder in Phase 1)
├── StatusBar.tsx                                # Bottom status bar
├── types.ts                                     # Category definitions, column configs
└── constants.ts                                 # Category metadata, default columns
```

### 3.3 Files Modified

```text
workspace-ui/
├── electron/main.ts                             # [MODIFY] Window config (title, size, route)
├── src/App.tsx                                  # [MODIFY] Route #/watchlist → WatchlistCommandCenter
├── src/store/useStore.ts                        # [MODIFY] Add watchlist categories state slice
└── src/components/intel/IntelDashboard.tsx       # [DEPRECATE] Replaced by WatchlistCommandCenter
```

---

## 4. Category Definition Schema

Each category is defined as a static configuration object used by the sidebar and grid.

```typescript
// types.ts

type CategoryId =
  | 'manual' | 'composite' | 'momentum' | 'gap_up' | 'gap_down'
  | 'breakout_up' | 'breakdown' | 'rvol' | 'options' | 'earnings'
  | 'ai_quant' | 'technical' | 'news' | 'institutional'
  | 'sector_rotation' | 'swing' | 'scalping' | 'favorites'

interface CategoryConfig {
  id: CategoryId
  label: string
  icon: string            // Emoji
  description: string
  columns: ColumnDef[]    // Ordered list of columns for this category
  allowManualAdd: boolean // Whether user can add/remove symbols manually
  sortDefault: { column: string; direction: 'asc' | 'desc' }
}

interface ColumnDef {
  key: string             // Field key in WatchlistSymbol
  label: string           // Display header
  width: number           // Column width in px
  align: 'left' | 'right' | 'center'
  format: 'text' | 'price' | 'percent' | 'volume' | 'ratio' | 'number'
  pinned?: boolean        // Always visible during horizontal scroll
  sortable?: boolean      // Allow sorting by this column
  conditionalFormat?: ConditionalFormatRule[]
}

interface ConditionalFormatRule {
  condition: 'gt' | 'lt' | 'gte' | 'lte' | 'eq'
  value: number
  style: {
    color?: string        // CSS variable
    fontWeight?: string
    background?: string
    animation?: string    // e.g., 'pulse 1s infinite'
  }
}

type AlertState = 'APPROACHING' | 'TRIGGERED' | 'CONFIRMED' | 'EXPIRED' | 'NONE'
```

### 4.1 Phase 1 Category Columns

In Phase 1, only the **Manual** and **Favorites** categories have functional symbol populations (manual add/remove). All other categories appear in the sidebar but display an empty grid with a "Coming soon — Phase N" placeholder message. They still define their column sets so the grid header switches correctly when selected.

#### Manual Category Columns

| # | Key | Label | Width | Align | Format | Pinned | Sortable |
|:--|:----|:------|:------|:------|:-------|:-------|:---------|
| 1 | `symbol` | Symbol | 80 | left | text | ✓ | ✓ |
| 2 | `price` | Last | 80 | right | price | ✓ | ✓ |
| 3 | `changePercent` | Chg % | 70 | right | percent | ✓ | ✓ |
| 4 | `volume` | Volume | 90 | right | volume | | ✓ |
| 5 | `rvol` | RVOL | 60 | right | ratio | | ✓ |
| 6 | `atr` | ATR | 60 | right | number | | ✓ |
| 7 | `spread` | Spread | 70 | right | price | | ✓ |
| 8 | `float` | Float | 80 | right | volume | | ✓ |
| 9 | `marketCap` | Mkt Cap | 90 | right | volume | | ✓ |
| 10 | `notes` | Notes | 150 | left | text | | | 
| 11 | — | ✕ | 30 | center | — | | | (remove button) |

#### Favorites Category Columns

Same as Manual minus `notes` column. Persisted to Redis via `POST /api/watchlist/favorites`.

---

## 5. Zustand Store Changes

### 5.1 New State Slice

```typescript
// Added to useStore.ts

interface WatchlistState {
  // Active category
  activeCategory: CategoryId
  setActiveCategory: (id: CategoryId) => void

  // Manual watchlist symbols (localStorage-persisted, same as current watchlist)
  manualSymbols: WatchlistSymbol[]
  addManualSymbol: (symbol: string) => void
  removeManualSymbol: (symbol: string) => void
  updateManualNote: (symbol: string, note: string) => void

  // Favorites (subset of manual, persisted to Redis)
  favoriteSymbols: string[]  // Just symbol strings
  toggleFavorite: (symbol: string) => void
  isFavorite: (symbol: string) => boolean

  // Selected symbol for Detail Panel
  selectedSymbol: string | null
  setSelectedSymbol: (symbol: string | null) => void

  // Sort state
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  setSort: (column: string) => void  // Toggles direction if same column

  // Detail panel visibility
  detailPanelOpen: boolean
  toggleDetailPanel: () => void
}
```

### 5.2 Migration from Current Watchlist

The current `watchlist: WatchlistTicker[]` in the store maps directly to the new `manualSymbols`. The existing `localStorage` key `quantstation:watchlist` will be read on startup to seed the Manual category, ensuring backward compatibility. The old `WatchlistPanel.tsx` add/remove logic migrates to `AddSymbolBar.tsx`.

---

## 6. Conditional Formatting Rules (Phase 1)

| Column | Condition | Style |
|:-------|:----------|:------|
| Change % | > 0 | `color: var(--qs-green)` |
| Change % | < 0 | `color: var(--qs-red)` |
| Change % | > +5% | `color: var(--qs-green); fontWeight: bold` |
| Change % | < -5% | `color: var(--qs-red); fontWeight: bold` |
| RVOL | > 3.0 | `color: var(--qs-amber); fontWeight: bold` |
| RVOL | > 5.0 | `color: var(--qs-amber); fontWeight: bold; animation: pulse` |
| Spread | < 0.05 | `color: var(--qs-green)` |
| Spread | > 0.50 | `color: var(--qs-red)` |

---

## 7. Interaction Model

### 7.1 Category Sidebar

| Action | Result |
|:-------|:-------|
| Click category | Switches grid to that category's column set and symbol list |
| Active category | Highlighted with left accent bar and lighter background |
| Badge count | Shows number of symbols in that category (Phase 1: only Manual and Favorites show non-zero counts) |

### 7.2 Symbol Grid

| Action | Result |
|:-------|:-------|
| Single-click row | Selects row, populates Detail Panel |
| Double-click row | Triggers `symbol:select` IPC to load in Workspace |
| Click column header | Sort by that column (toggle asc/desc) |
| Type in Add Symbol bar | Filter/autocomplete (Phase 1: exact match only) |
| Click ✕ button | Remove symbol from Manual/Favorites |

### 7.3 Detail Panel

| Action | Result |
|:-------|:-------|
| Click section header | Toggle section expand/collapse |
| Click symbol name in header | Trigger `symbol:select` IPC |
| Click collapse button | Hide entire Detail Panel (persisted to localStorage) |

---

## 8. Electron Main Process Changes

### 8.1 Window Config Update in `main.ts`

```typescript
// Update intelWindow creation
function createIntelWindow(): void {
  intelWindow = new BrowserWindow({
    width: 1600,    // Was 1000
    height: 1000,   // Was 800
    minWidth: 1200,  // Was 800
    minHeight: 700,  // Was 600
    title: 'QuantStation — Watchlists',  // Was 'Intel Dashboard'
    // ... rest unchanged
  })

  // Route change
  const hash = '/watchlist'  // Was '/intel'
  // ...
}
```

### 8.2 View Menu Update

```typescript
// In View menu template, rename label
{
  label: 'Watchlists',  // Was 'Intel Dashboard'
  type: 'checkbox',
  // ... rest unchanged
}
```

### 8.3 Route Update in `App.tsx`

```typescript
// Add new route, keep old as redirect for backward compat
if (route.startsWith('#/watchlist')) {
  return <WatchlistCommandCenter />
}
if (route.startsWith('#/intel')) {
  // Backward compat redirect
  window.location.hash = '#/watchlist'
  return <WatchlistCommandCenter />
}
```

---

## 9. Verification Plan

### 9.1 Acceptance Criteria

1. **Layout:** Three-panel layout renders at 1600×1000 and scales to 1200×700 without overflow.
2. **Category Switching:** All 17 categories appear in the sidebar. Clicking Manual/Favorites shows their symbols. Clicking others shows a "Coming soon" placeholder.
3. **Manual Watchlist:** Adding a symbol via the Add Symbol bar appends it to the Manual grid. Removing it via ✕ removes it. Persisted to localStorage across sessions.
4. **Favorites:** Toggling a symbol as favorite persists to Redis. Switching to Favorites category shows only favorited symbols.
5. **Symbol Selection:** Single-click highlights the row and populates the Detail Panel header. Double-click triggers IPC and loads the symbol in the Workspace window.
6. **Sorting:** Clicking a sortable column header sorts the grid. Clicking again reverses direction. Sort indicator arrow visible.
7. **Conditional Formatting:** Change % green/red. RVOL > 3 amber bold. RVOL > 5 amber pulse.
8. **Real-Time Updates:** Prices update from WebSocket tick stream without visible flicker or lag.
9. **Detail Panel Collapse:** Clicking collapse hides the panel. State persisted to localStorage. Re-opening restores it.
10. **Window Config:** Window title is "QuantStation — Watchlists". View menu shows "Watchlists" checkbox.
11. **Backward Compat:** Old `#/intel` route redirects to `#/watchlist`.

### 9.2 Performance Targets

| Metric | Target |
|:-------|:-------|
| Grid render (current watchlist ~8 symbols) | < 5ms |
| Category switch | < 50ms |
| Add/remove symbol | < 16ms (single frame) |
| Detail panel populate | < 50ms |

### 9.3 Manual Test Plan

1. Start the app → Watchlist window opens with Manual category active and existing watchlist symbols loaded.
2. Add `GOOG` via the Add Symbol bar → row appears at bottom with `--` placeholders until tick data arrives.
3. Click `NVDA` row → Detail Panel shows NVDA header with price and change %.
4. Double-click `TSLA` row → Workspace main window chart switches to TSLA.
5. Click Favorites in sidebar → grid shows only favorited symbols (initially empty).
6. Press `Space` on NVDA in Manual → NVDA appears in Favorites.
7. Click the Change % column header → rows sort by change %. Click again → reversed.
8. Click Detail Panel collapse button → panel hides. Restart app → panel stays hidden.
9. Close and reopen app → Manual symbols and Favorites preserved.
