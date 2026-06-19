# SPEC-002: QuantStation — Daily Intel & Watchlist Window (Multi-Window Expansion)

| Field         | Value                            |
|:--------------|:---------------------------------|
| **Status**    | Approved                         |
| **Author**    | QuantStation Team                |
| **Created**   | 2026-06-19                       |
| **Updated**   | 2026-06-19                       |
| **Platform**  | macOS / Apple Silicon (Mac Studio)|

---

## 1. Overview

To maintain maximum visual focus in the hot execution path, QuantStation isolates secondary dashboard elements (news, watchlists, economic calendars, and trading rules checklist) into a separate, dedicated Electron window. This **Daily Intel & Watchlist Dashboard** acts as the informational plane of the workstation, running alongside the main execution grid.

### 1.1 Design Goals

1. **Execution Zero-Distraction** — Keep charts, order books, and blotters free of slow-moving text news feeds or checklists.
2. **Multi-Monitor Native Support** — Spawns as a separate OS-level native window that can be dragged to a secondary physical screen.
3. **Cross-Window Synchronicity** — Low-latency IPC bridges window actions (e.g. double-clicking a ticker on the watchlist reloads the charts in the main workspace).
4. **Local State Persistence** — Daily checklist targets are saved in Redis to survive runtime crashes or updates.

---

## 2. Multi-Window Topology & Multi-Monitor Support

The main process in Electron acts as the single orchestrator. It manages two concurrent `BrowserWindow` instances:

1. **Main Workspace Window (`mainWindow`)**: Displays charts, order books, order entries, and positions blotter. Defaults to `1920x1080` screen bounds.
2. **Intel Dashboard Window (`intelWindow`)**: Displays the Watchlist, News, Macro Calendar, and Journal/Checklist. Defaults to `1000x800` screen bounds.

Because they are distinct native OS-level window objects:
- You can position them on independent physical displays (e.g. Chart/OMS on Screen 1, Intel/Watchlist on Screen 2).
- They share the same underlying renderer code bundle via React Router hash routes, loading `http://localhost:5173/#/` and `http://localhost:5173/#/intel` respectively.

---

## 3. Panel Specifications

The window is divided into a 4-panel glassmorphic dashboard:

```
┌───────────────────────────────────────┬───────────────────────────────────────┐
│ ❶ WATCHLIST PANEL                     │ ❷ REAL-TIME NEWS FEED                 │
│ Tabular grid: Symbol, Last, Chg %,    │ Vertical stream of headlines with     │
│ ATR, RVOL. Double-click selects.      │ impact badges [HIGH/MED] & tick tags. │
├───────────────────────────────────────┼───────────────────────────────────────┤
│ ❸ ECONOMIC CALENDAR & CATALYSTS       │ ❹ DAILY TARGETS & CHECKLIST           │
│ Chronological listing of macro releases│ Checklist items + profit/loss targets │
│ with expected impact and consensus.   │ backed by Redis persistence.          │
└───────────────────────────────────────┴───────────────────────────────────────┘
```

### 3.1 Watchlist Panel
- **Purpose**: Displays the universe of tickers selected for the active trading day.
- **Attributes**:
  - **Symbol**: Ticker ID.
  - **Last**: Last trade price (updated via WebSocket).
  - **Chg %**: Percentage change from previous close.
  - **ATR**: Average True Range (helps gauge immediate volatility ranges).
  - **RVOL**: Relative Volume (highlights current volume vs 20-day average).
- **Interactivity**: Double-clicking a row triggers an Electron IPC event notifying the main window to update its active symbol.

### 3.2 Real-Time News Feed
- **Purpose**: Displays real-time headlines filtered by relevance.
- **Attributes**:
  - Timestamps, Headlines, Tagged Tickers, Source.
  - **Impact Badge**: Color-coded categorization of potential volatility impact (`HIGH` = Red, `MED` = Amber, `LOW` = Blue).
- **Interactivity**: Clicking a tagged ticker updates the active symbol in the workspace.

### 3.3 Economic Calendar
- **Purpose**: Lists macroeconomic releases and catalyst schedules for the day.
- **Attributes**: Time of release, Currency area, Event name, Consensus, Previous, Actual.
- **Visuals**: Emphasizes events coming up in the next 15 minutes with a glowing orange pulse dot.

### 3.4 Daily Targets & Checklist (Redis Backed)
- **Purpose**: Session checklists, risk limits, and journal notes.
- **Fields**:
  - **Max Drawdown Target**: Maximum allowed loss for the session.
  - **Profit Goal**: Daily target.
  - **Custom Checkboxes**: List of custom items (e.g., "Pre-market routine complete", "Checked upcoming economic news", "Reset risk parameters").
  - **Scratch Notes**: Quick-write text notes.
- **Persistence**: Read/written through REST endpoints `GET /api/notes/daily` and `POST /api/notes/daily` which cache state in Redis.

---

## 4. Data & IPC Flow

```mermaid
sequenceDiagram
    participant Intel as Intel Window (Watchlist Panel)
    participant IPC as Electron IPC Bridge
    participant Main as Main Workspace (Charts & OMS)
    participant Redis as Redis Cache
    
    %% Cross-window Symbol Update
    Note over Intel: Double-click ticker "NVDA"
    Intel->>IPC: ipcRenderer.send("symbol:select", "NVDA")
    IPC->>Main: mainWindow.webContents.send("symbol:update", "NVDA")
    Note over Main: Zustand updates activeSymbol;<br/>PriceChart & OrderBook load NVDA
    
    %% Persistence of Session Notes
    Note over Intel: Checked "Pre-market check"
    Intel->>Redis: POST /api/notes/daily (save state)
```

### 4.1 IPC Channel Matrix

| Channel | Direction | Payload | Description |
|:---|:---|:---|:---|
| `symbol:select` | `Renderer (Intel) → Main` | `string` (symbol) | Emitted when ticker is double-clicked on watchlist |
| `symbol:update` | `Main → Renderer (Workspace)` | `string` (symbol) | Routed to main window to update workspace store |
| `window:minimize` | `Renderer → Main` | None | Minimizes target window |
| `window:maximize` | `Renderer → Main` | None | Maximizes target window |
| `window:close` | `Renderer → Main` | None | Closes target window |
