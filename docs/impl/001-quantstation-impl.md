# IMPL-001: QuantStation — Implementation Reference

| Field          | Value                                    |
|:---------------|:-----------------------------------------|
| **Spec**       | [SPEC-001](../spec/001-quantstation.md)  |
| **Status**     | Phase 1–6 Complete (Foundation)          |
| **Created**    | 2026-06-19                               |
| **Updated**    | 2026-06-19                               |

---

## 1. Repository Layout

```
quantstation/
├── .editorconfig                    # 4-space Java, 2-space TS/CSS
├── .env.example                     # Credential template
├── .gitignore                       # Java/Node/Docker/IDE/secrets
├── README.md                        # Architecture diagram, port map, quick-start
│
├── infra/                           # ═══ INFRASTRUCTURE AS CODE ═══
│   ├── docker-compose.yml           # QuestDB + Redis + IB Gateway (OrbStack)
│   ├── questdb/
│   │   ├── server.conf              # NVMe-tuned ingestion config
│   │   └── schema-init.sql          # 6 time-series table definitions
│   ├── redis/
│   │   └── redis.conf               # Pure in-memory, no persistence
│   └── ib-gateway/
│       └── jts.ini                  # API-only headless, paper port 4002
│
├── core-engine/                     # ═══ SPRING BOOT BACKEND ═══
│   ├── build.gradle.kts             # Spring Boot 3.4.1, Java 21, dependencies
│   ├── settings.gradle.kts          # Project name and repos
│   └── src/main/
│       ├── resources/
│       │   └── application.yml      # Config with paper/live/massive profiles
│       └── java/com/quantstation/
│           ├── QuantStationApp.java
│           ├── config/              # 4 config classes
│           ├── domain/              # 5 domain models
│           ├── execution/           # OMS + RiskManager + 3 IBKR classes
│           ├── marketdata/          # TickRouter + 3 provider adapters
│           ├── repository/          # Redis + QuestDB repositories
│           ├── strategy/            # Engine + interface + Signal
│           └── web/                 # WebSocket + REST controllers
│
├── workspace-ui/                    # ═══ ELECTRON + REACT UI ═══
│   ├── package.json                 # React 19, Electron, Zustand, STOMP.js
│   ├── electron.vite.config.ts      # Triple build (main/preload/renderer)
│   ├── tsconfig.json                # Strict TypeScript 5.6
│   ├── index.html                   # Vite entry point
│   ├── electron/
│   │   ├── main.ts                  # Electron main process
│   │   └── preload.ts               # Secure IPC bridge
│   └── src/
│       ├── main.tsx                 # React entry
│       ├── App.tsx                  # 4-panel grid layout
│       ├── index.css                # Full design system
│       ├── components/              # 5 trading components
│       ├── hooks/                   # WebSocket connection hook
│       ├── store/                   # Zustand state management
│       └── types/                   # TypeScript interfaces
│
└── scripts/                         # ═══ OPERATIONAL SCRIPTS ═══
    ├── start-pod.sh                 # Master orchestrator
    ├── stop-pod.sh                  # Graceful shutdown
    ├── check-io-bottleneck.sh       # Docker I/O validation
    └── backup-questdb.sh            # Cold storage dump
```

**Total source files:** 61

---

## 2. Infrastructure Implementation

### 2.1 Docker Compose

**File:** [`infra/docker-compose.yml`](../../quantstation/infra/docker-compose.yml)

Three services on a custom bridge network `quantstation-net` (subnet `172.18.0.0/16`):

| Service       | Container Name            | IP           | Memory | Volumes                |
|:--------------|:--------------------------|:-------------|:-------|:-----------------------|
| `questdb`     | `quantstation-questdb`    | `172.18.0.10`| 8GB    | Named: `questdb_data`  |
| `redis`       | `quantstation-redis`      | `172.18.0.11`| 2GB    | Named: `redis_data`    |
| `ib-gateway`  | `quantstation-ib-gateway` | `172.18.0.12`| 2GB    | Bind: `jts.ini`        |

**Design decisions:**
- Named volumes for QuestDB/Redis — faster than bind mounts through the virtualization layer
- Fixed IPs via IPAM subnet — deterministic for firewall rules and `TrustedIPs` in jts.ini
- Health checks on all services with appropriate start periods (QuestDB: 15s, IB Gateway: 60s)
- IB Gateway credentials via environment variables from `.env` file

### 2.2 QuestDB Configuration

**File:** [`infra/questdb/server.conf`](../../quantstation/infra/questdb/server.conf)

Key tuning for NVMe workload:

| Parameter                              | Value     | Rationale                              |
|:---------------------------------------|:----------|:---------------------------------------|
| `cairo.max.uncommitted.rows`           | 500,000   | Large buffer before forced commit      |
| `cairo.commit.lag`                     | 240ms     | Allow ingestion batching               |
| `line.tcp.worker.count`               | 4         | Match Apple Silicon P-cores            |
| `line.tcp.commitment.interval.fraction`| 0.5       | Balance latency vs throughput          |
| `shared.worker.count`                  | 4         | Parallel query workers                 |
| `wal.enabled.default`                  | true      | Crash recovery on all tables           |
| `metrics.enabled`                      | true      | Prometheus monitoring endpoint         |

### 2.3 QuestDB Schema

**File:** [`infra/questdb/schema-init.sql`](../../quantstation/infra/questdb/schema-init.sql)

Six WAL-enabled tables with SYMBOL caching for high-cardinality columns:

| Table            | Partition | Dedup Keys          | Notable Columns                  |
|:-----------------|:----------|:--------------------|:---------------------------------|
| `ticks`          | DAY       | `symbol, timestamp` | price, size, exchange, conditions|
| `ohlcv`          | MONTH     | —                   | timeframe, vwap, trade_count     |
| `options_chain`  | DAY       | —                   | All 5 Greeks, IV, OI             |
| `order_audit`    | MONTH     | —                   | Full order state history         |
| `pnl_snapshots`  | MONTH     | —                   | Unrealized/realized/total/NAV    |
| `eod_prices`     | YEAR      | —                   | Adjusted close, dividends, splits|

### 2.4 Redis Configuration

**File:** [`infra/redis/redis.conf`](../../quantstation/infra/redis/redis.conf)

Pure in-memory, zero persistence — all state is reconstructable from QuestDB + IB Gateway:

| Setting                  | Value        | Rationale                         |
|:-------------------------|:-------------|:----------------------------------|
| `save ""`                | Disabled     | No RDB snapshots                  |
| `appendonly no`          | Disabled     | No AOF persistence                |
| `maxmemory`              | 2GB          | Hard limit with LRU eviction      |
| `hz`                     | 100          | 100Hz timer for fast key expiry   |
| `io-threads`             | 4            | Multi-threaded I/O for Apple Silicon |
| `latency-monitor-threshold` | 1ms      | Alert on slow operations          |
| `notify-keyspace-events` | `Kx`         | Key events for strategy triggers  |

---

## 3. Core Engine Implementation

### 3.1 Application Entry Point

**File:** [`QuantStationApp.java`](../../quantstation/core-engine/src/main/java/com/quantstation/QuantStationApp.java)

```java
@SpringBootApplication
@EnableAsync
@EnableScheduling
public class QuantStationApp { ... }
```

Spring Boot auto-configuration with `spring.threads.virtual.enabled=true` in application.yml.

### 3.2 Configuration Classes

| Class | File | Key Behavior |
|:------|:-----|:-------------|
| `VirtualThreadConfig` | [`VirtualThreadConfig.java`](../../quantstation/core-engine/src/main/java/com/quantstation/config/VirtualThreadConfig.java) | Overrides Tomcat executor + async executor with `newVirtualThreadPerTaskExecutor()` |
| `RedisConfig` | [`RedisConfig.java`](../../quantstation/core-engine/src/main/java/com/quantstation/config/RedisConfig.java) | `RedisTemplate<String, Object>` with String keys + Jackson JSON values |
| `WebSocketConfig` | [`WebSocketConfig.java`](../../quantstation/core-engine/src/main/java/com/quantstation/config/WebSocketConfig.java) | STOMP broker on `/ws`, `/topic` destinations, `/app` prefix |
| `QuestDbConfig` | [`QuestDbConfig.java`](../../quantstation/core-engine/src/main/java/com/quantstation/config/QuestDbConfig.java) | ILP `Sender` bean (TCP to :9009), auto-closed on shutdown |

### 3.3 Domain Models

| Model | Type | File | Notable Features |
|:------|:-----|:-----|:-----------------|
| `Tick` | `record` | [`Tick.java`](../../quantstation/core-engine/src/main/java/com/quantstation/domain/Tick.java) | Factory methods: `trade()`, `quote()`; computed: `midPrice()`, `spread()` |
| `Order` | `class` | [`Order.java`](../../quantstation/core-engine/src/main/java/com/quantstation/domain/Order.java) | State machine: `PENDING→SUBMITTED→PARTIAL_FILL→FILLED\|CANCELLED\|REJECTED`; weighted avg fill price aggregation |
| `Position` | `class` | [`Position.java`](../../quantstation/core-engine/src/main/java/com/quantstation/domain/Position.java) | Fill application with cost basis tracking; handles opening/closing/flipping positions; real-time PnL |
| `OptionGreeks` | `record` | [`OptionGreeks.java`](../../quantstation/core-engine/src/main/java/com/quantstation/domain/OptionGreeks.java) | All 5 Greeks + IV; computed: `extrinsicValue()`, `isItm()` |
| `BarData` | `record` | [`BarData.java`](../../quantstation/core-engine/src/main/java/com/quantstation/domain/BarData.java) | OHLCV + VWAP + timeframe; computed: `range()`, `bodySize()`, `isBullish()`, `changePercent()` |

**Order State Machine:**

```
                    ┌────────► CANCELLED
                    │
PENDING ──► SUBMITTED ──► PARTIAL_FILL ──► FILLED
                    │
                    └────────► REJECTED
```

**Position Cost Basis Logic:**
- **Opening/Adding:** Weighted average cost: `totalCost / |quantity|`
- **Reducing/Closing:** Realizes PnL at `(fillPrice - avgCost) * closingQty * sign(quantity)`
- **Flipping:** Closes existing position, opens new at fill price

### 3.4 Execution Plane

#### OrderManagementSystem

**File:** [`OrderManagementSystem.java`](../../quantstation/core-engine/src/main/java/com/quantstation/execution/OrderManagementSystem.java)

- Thread-safe `ConcurrentHashMap` for active orders and positions
- Pipeline: `validate → track → route → persist → push`
- Fill handling: updates order state, position cost basis, and pushes to Redis + UI
- Terminal order cleanup: removes from active map on FILLED/CANCELLED/REJECTED

#### RiskManager

**File:** [`RiskManager.java`](../../quantstation/core-engine/src/main/java/com/quantstation/execution/RiskManager.java)

Pre-trade validation with three checks (configurable via `application.yml`):

1. **Order value** — `quantity * limitPrice ≤ max-order-value`
2. **Position size** — `currentQty + orderQty ≤ max-position-size`
3. **Daily loss** — `dailyRealizedPnl > -max-daily-loss`

Returns `Optional<String>` — empty if valid, rejection reason if not.

#### IBKR Integration (3 classes)

| Class | File | Responsibility |
|:------|:-----|:---------------|
| `IbkrConnectionManager` | [`IbkrConnectionManager.java`](../../quantstation/core-engine/src/main/java/com/quantstation/execution/ibkr/IbkrConnectionManager.java) | TCP socket lifecycle, reconnection, `AtomicInteger` order ID sequencing |
| `IbkrOrderRouter` | [`IbkrOrderRouter.java`](../../quantstation/core-engine/src/main/java/com/quantstation/execution/ibkr/IbkrOrderRouter.java) | `Order` → IB `Contract` + `Order` translation, place/cancel |
| `IbkrCallbackHandler` | [`IbkrCallbackHandler.java`](../../quantstation/core-engine/src/main/java/com/quantstation/execution/ibkr/IbkrCallbackHandler.java) | `EWrapper` bridge: dispatches to OMS (fills), TickRouter (data), ConnectionManager (lifecycle) |

**Current status:** Framework complete with documented TODO stubs for TWS API JAR integration. The connection lifecycle, callback routing, and order translation patterns are fully designed.

### 3.5 Data Plane

#### TickRouter (Core Fan-Out Hub)

**File:** [`TickRouter.java`](../../quantstation/core-engine/src/main/java/com/quantstation/marketdata/TickRouter.java)

```
onTick(tick)
  ├──► redisState.updateLastPrice()          // instant write
  ├──► questDbWriter.bufferTick()            // lock-free queue, 100ms flush
  ├──► strategyEngine.onTick()               // signal generation
  └──► latestTicks.put(symbol, tick)          // UI buffer (ConcurrentHashMap)
                                              // flushed every 50ms by scheduler
```

- UI push scheduler: `ScheduledExecutorService` on virtual thread factory, 50ms cadence
- Snapshot-and-clear pattern minimizes lock time: `Map.copyOf()` → `clear()` → send

#### MarketDataProvider Interface

**File:** [`MarketDataProvider.java`](../../quantstation/core-engine/src/main/java/com/quantstation/marketdata/MarketDataProvider.java)

Strategy pattern with three implementations:

| Implementation | Profile(s) | Status |
|:---------------|:-----------|:-------|
| `IbkrMarketDataAdapter` | `default`, `paper`, `live` | Active (stub for TWS API) |
| `MassiveStreamClient` | `massive` | Skeleton (contract stub) |
| Alpha Vantage | Always available | Active (REST, not streaming) |

Hot-swap via Spring `@Profile` — zero Execution Plane changes.

#### Alpha Vantage Client

**File:** [`AlphaVantageClient.java`](../../quantstation/core-engine/src/main/java/com/quantstation/marketdata/alphavantage/AlphaVantageClient.java)

- REST client with `RestTemplate`
- Redis caching: key pattern `qs:av:{type}:{symbol}`, configurable TTL (default 60min)
- Rate limiting: synchronized 12-second minimum interval (5 req/min free tier)
- All methods `@Async` — non-blocking for the caller
- Endpoints: `getDailyPrices()`, `getCompanyOverview()`, `getEarnings()`, `getTechnicalIndicator()`

### 3.6 Repository Layer

#### RedisStateRepository

**File:** [`RedisStateRepository.java`](../../quantstation/core-engine/src/main/java/com/quantstation/repository/RedisStateRepository.java)

Structured key namespace:

```
qs:price:{symbol}            → Double (last price)
qs:position:{symbol}         → Position (JSON)
qs:order:{orderId}           → Order (JSON)
qs:greeks:{contractSymbol}   → OptionGreeks (JSON)
qs:pnl:total                 → Double (total PnL)
```

#### QuestDbTickWriter

**File:** [`QuestDbTickWriter.java`](../../quantstation/core-engine/src/main/java/com/quantstation/repository/QuestDbTickWriter.java)

- **Buffer:** `ConcurrentLinkedQueue<Tick>` — lock-free, non-blocking `offer()`
- **Flush:** `ScheduledExecutorService` on virtual thread, 100ms cadence, batch up to 1000 rows
- **Backpressure:** Drop ticks if buffer > `batchSize * 10` (prevents OOM)
- **Monitoring:** Atomic counters for `totalWritten`, `totalDropped`, `bufferSize`
- **Shutdown:** Final flush on `@PreDestroy`

### 3.7 Strategy Engine

| Class | File | Purpose |
|:------|:-----|:--------|
| `Strategy` | [`Strategy.java`](../../quantstation/core-engine/src/main/java/com/quantstation/strategy/Strategy.java) | Interface: `onTick()→Signal`, `onBar()→Signal`, `onFill()`, `initialize()`, `shutdown()` |
| `Signal` | [`Signal.java`](../../quantstation/core-engine/src/main/java/com/quantstation/strategy/signals/Signal.java) | Record: factory methods (`marketBuy`, `marketSell`, `limitBuy`), `toOrder()` conversion |
| `StrategyEngine` | [`StrategyEngine.java`](../../quantstation/core-engine/src/main/java/com/quantstation/strategy/StrategyEngine.java) | Registry (`CopyOnWriteArrayList`), tick dispatch, signal→OMS routing |

### 3.8 Web Layer

| Class | File | Endpoints |
|:------|:-----|:----------|
| `UiWebSocketController` | [`UiWebSocketController.java`](../../quantstation/core-engine/src/main/java/com/quantstation/web/UiWebSocketController.java) | Push methods: `pushTick()`, `pushOrderUpdate()`, `pushPositionUpdate()`, `pushPnlUpdate()` |
| `UiRestController` | [`UiRestController.java`](../../quantstation/core-engine/src/main/java/com/quantstation/web/UiRestController.java) | `POST /api/orders`, `DELETE /api/orders/{id}`, `GET /api/orders`, `GET /api/positions`, `GET /api/status` |

### 3.9 Application Configuration

**File:** [`application.yml`](../../quantstation/core-engine/src/main/resources/application.yml)

Three Spring profiles:

| Profile   | IB Port | Risk Confirmation | Use Case          |
|:----------|:--------|:-------------------|:------------------|
| `paper`   | 4002    | $10,000            | Development       |
| `live`    | 4001    | $5,000             | Production        |
| `massive` | —       | —                  | Massive.com data  |

---

## 4. Workspace UI Implementation

### 4.1 Build Configuration

| File | Purpose |
|:-----|:--------|
| [`package.json`](../../quantstation/workspace-ui/package.json) | React 19, Electron 33, electron-vite 2.4, Zustand 5, STOMP.js 7, Lightweight Charts 4.2 |
| [`electron.vite.config.ts`](../../quantstation/workspace-ui/electron.vite.config.ts) | Triple build target: main process, preload script, React renderer |
| [`tsconfig.json`](../../quantstation/workspace-ui/tsconfig.json) | Strict mode, ES2022, bundler resolution, `@/*` path alias |

### 4.2 Electron Layer

| File | Responsibility |
|:-----|:---------------|
| [`electron/main.ts`](../../quantstation/workspace-ui/electron/main.ts) | Window management: 1920×1080, `hiddenInset` title bar, macOS traffic lights, Vite dev server support |
| [`electron/preload.ts`](../../quantstation/workspace-ui/electron/preload.ts) | Secure `contextBridge` API: platform info, window controls (`minimize`, `maximize`, `close`) |

### 4.3 Design System

**File:** [`src/index.css`](../../quantstation/workspace-ui/src/index.css)

Trading-standard dark theme built on CSS custom properties:

| Token Category  | Examples                                                  |
|:----------------|:----------------------------------------------------------|
| Background      | `--qs-bg-primary` (hsl 230, 25%, 5%) through elevated    |
| Text            | `--qs-text-primary`, `--qs-text-secondary`, `--qs-text-muted` |
| Trading Colors  | `--qs-green` (145°), `--qs-red` (0°), `--qs-blue` (215°)|
| Typography      | `--qs-font-mono` (JetBrains Mono), `--qs-font-sans` (Inter) |
| Sizing          | `--qs-font-xs` (11px) through `--qs-font-2xl` (24px)    |

Includes: panel grid system, order book styles, PnL cards, status badges, blotter table, micro-animations (`flash-green`, `flash-red`), pulse dot indicator, custom scrollbar.

### 4.4 State Management (Zustand)

**File:** [`src/store/useStore.ts`](../../quantstation/workspace-ui/src/store/useStore.ts)

Single store driven by WebSocket:

| Slice          | Type                        | Update Pattern                    |
|:---------------|:----------------------------|:----------------------------------|
| `ticks`        | `Record<string, Tick>`      | Keyed by symbol (O(1) lookups)   |
| `orders`       | `Order[]`                   | Upsert by `orderId`             |
| `positions`    | `Record<string, Position>`  | Keyed by symbol                  |
| `pnl`          | `PnlSnapshot`               | Full replace                     |
| `connected`    | `boolean`                   | Set by WebSocket lifecycle       |
| `activeSymbol` | `string`                    | Set by user (default: `SPY`)     |

### 4.5 WebSocket Hook

**File:** [`src/hooks/useMarketStream.ts`](../../quantstation/workspace-ui/src/hooks/useMarketStream.ts)

STOMP client (`@stomp/stompjs`) lifecycle:
- Connects to `ws://localhost:8080/ws`
- Subscribes to 4 topics on connect: ticks, orders, positions, PnL
- Auto-reconnect with 2s delay
- Heartbeat: 10s incoming/outgoing
- Re-subscribes when `activeSymbol` changes

### 4.6 Components

| Component | File | Description |
|:----------|:-----|:------------|
| `OrderBook` | [`OrderBook.tsx`](../../quantstation/workspace-ui/src/components/orderbook/OrderBook.tsx) | L2 depth with bid/ask size bars, spread display, hover highlighting |
| `PriceChart` | [`PriceChart.tsx`](../../quantstation/workspace-ui/src/components/charting/PriceChart.tsx) | Lightweight Charts candlestick + volume, dark theme, `ResizeObserver` |
| `OrderEntry` | [`OrderEntry.tsx`](../../quantstation/workspace-ui/src/components/execution/OrderEntry.tsx) | Form: symbol, qty, type, limit price; Buy/Sell buttons → REST API |
| `OrderBlotter` | [`OrderBlotter.tsx`](../../quantstation/workspace-ui/src/components/execution/OrderBlotter.tsx) | Table with status badges, cancel buttons, fill tracking |
| `PnlTicker` | [`PnlTicker.tsx`](../../quantstation/workspace-ui/src/components/pnl/PnlTicker.tsx) | 3 PnL cards (unrealized/realized/total) + positions table |

### 4.7 App Layout

**File:** [`src/App.tsx`](../../quantstation/workspace-ui/src/App.tsx)

CSS Grid: `grid-template-columns: 300px 1fr 320px`, `grid-template-rows: 1fr 280px`

Custom title bar with: app name, active symbol badge, search input, connection status pulse dot.

---

## 5. Operational Scripts

| Script | File | Steps |
|:-------|:-----|:------|
| `start-pod.sh` | [`scripts/start-pod.sh`](../../quantstation/scripts/start-pod.sh) | Check Docker + Java → load `.env` → `docker compose up -d` → wait for health checks (Redis PING, QuestDB HTTP, IB Gateway TCP) → `gradlew bootRun` |
| `stop-pod.sh` | [`scripts/stop-pod.sh`](../../quantstation/scripts/stop-pod.sh) | Kill Spring Boot (SIGTERM) → `docker compose down` |
| `check-io-bottleneck.sh` | [`scripts/check-io-bottleneck.sh`](../../quantstation/scripts/check-io-bottleneck.sh) | Detect OrbStack/Docker Desktop → check VirtioFS → 256MB `dd` write test inside QuestDB container → verify ≥1GB/s → check named volumes |
| `backup-questdb.sh` | [`scripts/backup-questdb.sh`](../../quantstation/scripts/backup-questdb.sh) | Snapshot volume (or CSV export) → timestamped tar.gz → retain last 7 backups |

---

## 6. Remaining Work (Post-Foundation)

### 6.1 IB TWS API Integration

The IBKR layer has complete architecture and callback routing but requires the TWS API JARs:

1. Download TWS API from IBKR Campus
2. Place JARs in `core-engine/libs/` or publish to local Maven repo
3. Add `flatDir` or `maven` dependency in `build.gradle.kts`
4. Implement `EWrapper` interface in `IbkrCallbackHandler`
5. Wire `EClientSocket` in `IbkrConnectionManager.connect()`
6. Implement `Contract`/`Order` builders in `IbkrOrderRouter`

### 6.2 Massive.com Integration

Skeleton in place (`MassiveStreamClient.java`). To activate:

1. Add `massive-com/client-jvm` dependency
2. Implement WebSocket connection lifecycle
3. Parse incoming trade/quote messages
4. Forward to `TickRouter` via `TickListener`
5. Switch profile to `massive`

### 6.3 Gradle Wrapper

Generate the wrapper for portable builds:

```bash
cd core-engine && gradle wrapper --gradle-version 9.2
```

### 6.4 Frontend Dependencies

```bash
cd workspace-ui && pnpm install
```

### 6.5 Unit Tests

Priority test cases to implement:
### 3. Docker Containerization & Pod Verification (Success)
We successfully dockerized the **Spring Boot Core Engine** by adding a robust, glibc-based `Dockerfile` utilizing `eclipse-temurin:21` (resolving dynamic library loading issues for QuestDB). 

The containerized stack has been fully validated:
- **Port Conflict Fix**: Re-mapped IB Gateway's VNC debugging port from `5900` to `5990` to avoid conflicts with macOS built-in Screen Sharing.
- **Subnet Pool Conflict Fix**: Switched to a standard bridge network (`quantstation-net`) to eliminate overlapping subnet conflicts.
- **Unified Orchestration**: Updated `scripts/start-pod.sh` to wait for the containerized Core Engine's Actuator health check.
- **Execution Success**: Launched the complete stack via `start-pod.sh` (Redis, QuestDB, IB Gateway, and Core Engine all showing healthy states).

---

## Next Steps

1. **Install IB TWS API JARs**: Download from IBKR Campus, add to `core-engine/libs/` or local repository, and uncomment `EWrapper` / connection bindings in the execution adapters.
2. **Configure credentials**: Edit `.env` and fill in your IBKR paper trading credentials.
3. **Run the Workspace UI**: Launch the Electron UI in development mode via `pnpm run dev` from the `workspace-ui/` directory.
4. **Implement Strategy**: Create concrete strategy components (e.g., MeanReversionStrategy) extending the `Strategy` interface. Example starting point:

```java
@Component
public class MeanReversionStrategy implements Strategy {
    // Subscribe to SPY, compute 20-period SMA on ticks,
    // generate BUY signal when price < SMA - 2σ
}
```
