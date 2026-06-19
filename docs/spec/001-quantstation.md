# SPEC-001: QuantStation — Single-Workstation Ultra-Low Latency Trading Architecture

| Field         | Value                            |
|:--------------|:---------------------------------|
| **Status**    | Approved                         |
| **Author**    | QuantStation Team                |
| **Created**   | 2026-06-19                       |
| **Updated**   | 2026-06-19                       |
| **Platform**  | macOS / Apple Silicon (Mac Studio)|

---

## 1. Overview

QuantStation compresses an institutional trading pod onto a single high-performance Mac Studio. By localizing the entire execution and data fabric on one machine (leveraging its immense unified memory bandwidth and high NVMe IOPS), the system eliminates the variable public-internet hops required by cloud-hosted setups.

### 1.1 Design Goals

1. **Ultra-Low Latency** — Sub-5ms tick-to-UI render on the loopback interface
2. **Plane Isolation** — Strict separation between Execution (order routing) and Data Fabric (ingestion/storage)
3. **Hot-Swap Data Pipes** — Transition from IBKR market data to Massive.com (ex-Polygon.io) with zero execution-plane changes
4. **Single Operator** — Optimized for a solo quantitative developer; no multi-tenancy overhead
5. **Reproducible Infrastructure** — Every service configuration is codified for portability to bare-metal Linux

---

## 2. Architecture Topology

The system is strictly divided into two distinct planes:

- **Execution Plane** — Manages order state and routing via IB Gateway
- **Data Fabric** — Manages ingestion, real-time variables, and historical storage

Spring Boot acts as the central nervous system bridging both.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Mac Studio — QuantStation                           │
│                                                                        │
│  ┌──────────────────┐     ┌──────────────────────────────────────┐    │
│  │  Workspace UI     │     │  Core Engine (Spring Boot / Java 21) │    │
│  │  Electron + React │◄───►│                                      │    │
│  │  TypeScript       │ WS  │  ┌──────────┐  ┌─────────────────┐  │    │
│  │                   │     │  │ Execution │  │   Data Plane    │  │    │
│  │  • Order Book     │     │  │  Plane    │  │                 │  │    │
│  │  • Price Chart    │     │  │          │  │  ┌───────────┐  │  │    │
│  │  • Order Entry    │     │  │  OMS     │  │  │TickRouter │  │  │    │
│  │  • PnL Ticker     │     │  │  Risk    │  │  │ (fan-out) │  │  │    │
│  │  • Order Blotter  │     │  │  IBKR    │  │  └───────────┘  │  │    │
│  └──────────────────┘     │  └──────────┘  └─────────────────┘  │    │
│                            └──────────────────────────────────────┘    │
│                                        │          │         │          │
│                            ┌───────────┘          │         └────────┐ │
│                            ▼                      ▼                  ▼ │
│                   ┌──────────────┐    ┌──────────────┐   ┌──────────┐ │
│                   │  IB Gateway   │    │   QuestDB     │   │  Redis   │ │
│                   │  (Docker)     │    │   (Docker)    │   │ (Docker) │ │
│                   │  :4002 paper  │    │   :9009 ILP   │   │ :6379    │ │
│                   └──────┬───────┘    │   :8812 PG    │   └──────────┘ │
│                          │            │   :9000 HTTP   │                │
│                          │            └──────────────┘                 │
└──────────────────────────┼─────────────────────────────────────────────┘
                           │
                    ┌──────┴───────┐
                    │ IBKR Servers  │
                    │ (Internet)    │
                    └──────────────┘
```

---

## 3. Component Specification

### 3.1 Workspace UI (Electron + React/TypeScript)

| Property       | Value                                        |
|:---------------|:---------------------------------------------|
| **Framework**  | Electron + React 19 + TypeScript 5.x         |
| **Build Tool** | electron-vite (Vite 6)                       |
| **Charting**   | TradingView Lightweight Charts (WebGL)       |
| **State**      | Zustand 5                                    |
| **Transport**  | STOMP over WebSocket (`ws://localhost:8080/ws`) |

**Role:** The command center. Renders the order book, charting, and execution tools without the overhead of browser-based DOM throttling. Runs locally alongside the Java engine.

**Zero-Latency IPC Model:** The frontend connects via `ws://localhost:8080` over the loopback interface. No JWT authentication, CORS handling, or HTTPS encryption overhead — pure internal networking.

**UI Layout — 4-Panel Grid:**

```
┌──────────┬──────────────────┬───────────┐
│          │                  │  Order    │
│  Order   │   Price Chart    │  Entry    │
│  Book    │  (Lightweight    │  + PnL    │
│  (L2)    │   Charts/WebGL)  │  Ticker   │
│          ├──────────────────┴───────────┤
│          │      Order Blotter           │
└──────────┴──────────────────────────────┘
```

**Data Push Topics (STOMP):**

| Topic                      | Payload        | Cadence           |
|:---------------------------|:---------------|:------------------|
| `/topic/ticks/{symbol}`    | `Tick`         | Throttled @ 50ms  |
| `/topic/orders`            | `Order`        | On state change   |
| `/topic/positions`         | `Position`     | On fill           |
| `/topic/pnl`               | `PnlSnapshot`  | Periodic          |
| `/topic/greeks/{symbol}`   | `OptionGreeks` | On update         |

### 3.2 Core Engine (Spring Boot / Java 21)

| Property          | Value                                    |
|:------------------|:-----------------------------------------|
| **Framework**     | Spring Boot 3.4.1                        |
| **Java**          | 21 LTS (Virtual Threads / Project Loom)  |
| **Build**         | Gradle 9.x, Kotlin DSL                  |
| **Redis Client**  | Lettuce (async, non-blocking)            |
| **QuestDB Client**| ILP Sender (TCP, batch flush)            |
| **IB API**        | Official TWS API (TCP socket)            |

**Role:** The brain. Manages API rate limits, runs risk-tracking analytics, executes automated strategies, and bridges the Execution Plane and Data Fabric.

**Virtual Threads (Project Loom):** Traditional thread pools choke under high-frequency WebSocket tick data. Virtual threads allow tens of thousands of concurrent non-blocking socket connections without memory starvation. They handle the **management layer** (WebSocket sessions, REST endpoints, market data fan-out). The **hot trading path** (OMS → RiskManager → IbkrOrderRouter) is designed for dedicated platform threads with minimal GC jitter.

**Package Architecture:**

```
com.quantstation/
├── config/         # Spring configuration (VirtualThread, Redis, WebSocket, QuestDB)
├── domain/         # Core models (Tick, Order, Position, OptionGreeks, BarData)
├── execution/      # ═══ EXECUTION PLANE ═══
│   ├── OMS         # Order lifecycle state machine
│   ├── RiskManager # Pre-trade validation
│   └── ibkr/       # IB Gateway TWS API wrapper
├── marketdata/     # ═══ DATA PLANE ═══
│   ├── TickRouter  # 4-way tick fan-out
│   ├── ibkr/       # Current: IBKR market data adapter
│   ├── massive/    # Future: Massive.com WebSocket client
│   └── alphavantage/ # Supplementary: fundamentals + EOD
├── repository/     # Redis state + QuestDB batch writer
├── strategy/       # Strategy engine, interfaces, signals
└── web/            # WebSocket + REST controllers
```

### 3.3 Local Data Fabric

#### 3.3.1 Redis 7 (In-Memory Live State)

| Property          | Value                       |
|:------------------|:----------------------------|
| **Image**         | `redis:7-alpine` (ARM64)    |
| **Memory Limit**  | 2GB                         |
| **Persistence**   | Disabled (`save ""`)        |
| **I/O Threads**   | 4 (multi-threaded I/O)      |
| **Internal Timer**| 100Hz                       |
| **Latency Alert** | 1ms threshold               |

**Role:** Runs entirely in memory. Tracks live active option chains, Greeks matrix, and real-time PnL. Spring Boot reads/writes to Redis for instantaneous state lookups before firing orders.

**Key Structure:**

| Key Pattern                | Value Type    | Purpose                  |
|:---------------------------|:--------------|:-------------------------|
| `qs:price:{symbol}`        | String        | Last traded price        |
| `qs:position:{symbol}`     | JSON (Hash)   | Live position state      |
| `qs:order:{orderId}`       | JSON (Hash)   | Active order state       |
| `qs:greeks:{contractSymbol}` | JSON (Hash) | Options Greeks           |
| `qs:pnl:total`             | String        | Total portfolio PnL      |
| `qs:av:*`                  | JSON (Cached) | Alpha Vantage API cache  |

#### 3.3.2 QuestDB (Time-Series Storage)

| Property          | Value                            |
|:------------------|:---------------------------------|
| **Image**         | `questdb/questdb:latest` (ARM64) |
| **Memory Limit**  | 8GB                              |
| **Ingestion**     | InfluxDB Line Protocol (TCP :9009) |
| **SQL Queries**   | PostgreSQL Wire Protocol (:8812) |
| **Web Console**   | HTTP :9000                       |
| **Workers**       | 4 ILP workers, 2 PG workers     |

**Role:** Engineered for massive time-series ingestion. Acts as the local tick plant, capturing the raw market data hose and flushing to NVMe for backtesting and historical chart rendering.

**Tables:**

| Table            | Partition | Purpose                           |
|:-----------------|:----------|:----------------------------------|
| `ticks`          | DAY       | Raw trade ticks (dedup on symbol+ts) |
| `ohlcv`          | MONTH     | Aggregated candlestick bars       |
| `options_chain`  | DAY       | Options chain snapshots with Greeks |
| `order_audit`    | MONTH     | Immutable order state transitions |
| `pnl_snapshots`  | MONTH     | Periodic portfolio PnL snapshots  |
| `eod_prices`     | YEAR      | Alpha Vantage end-of-day data     |

### 3.4 Execution Infrastructure (IB Gateway)

| Property           | Value                                |
|:-------------------|:-------------------------------------|
| **Image**          | `gnzsnz/ib-gateway:latest` (ARM64)   |
| **Default Mode**   | Paper trading (port 4002)            |
| **API Protocol**   | TWS API (TCP socket)                 |
| **Connection**     | Stateful TCP to IBKR servers         |

**Role:** A lightweight Dockerized instance of Interactive Brokers Gateway. Spring Boot connects to this local container for order routing and account queries.

**IB API Integration Strategy:**
- Official TWS API (TCP socket, callback-driven) for maximum performance
- `IbkrCallbackHandler` implements `EWrapper`, bridges callbacks to `CompletableFuture` / service dispatch
- `IbkrOrderRouter` translates `Order` domain objects to IB `Contract` + `Order` API calls
- `IbkrConnectionManager` handles lifecycle, reconnection, and order ID sequencing

---

## 4. Data Flow Specification

### 4.1 Tick Ingestion (Hot Path)

```
IB Gateway ──TCP──► IbkrCallbackHandler.tickPrice()
                          │
                          ▼
                    IbkrMarketDataAdapter.forwardTick()
                          │
                          ▼
                    TickRouter.onTick(tick)
                      ├──► Redis: updateLastPrice()          [instant]
                      ├──► QuestDB: bufferTick()             [batch, 100ms flush]
                      ├──► StrategyEngine: onTick()          [signal generation]
                      └──► UI buffer (latestTicks map)       [push every 50ms]
```

**Throttling:** The UI push is throttled at 50ms intervals via `ScheduledExecutorService` to prevent overwhelming the Electron renderer. The latest tick per symbol is buffered and the snapshot is pushed at cadence.

**Backpressure:** The QuestDB writer uses a `ConcurrentLinkedQueue` with a hard limit of `batchSize * 10` entries. If the buffer exceeds this, ticks are dropped rather than causing memory pressure.

### 4.2 Order Execution (Critical Path)

```
UI (OrderEntry) ──HTTP POST──► UiRestController.submitOrder()
                                      │
                                      ▼
                               OrderManagementSystem.submitOrder()
                                 ├──► RiskManager.validate()
                                 │      ├── Max position size check
                                 │      ├── Max order value check
                                 │      └── Daily loss limit check
                                 │
                                 ├──[REJECTED]──► UI push (order update)
                                 │
                                 └──[PASSED]──► IbkrOrderRouter.routeOrder()
                                                  │
                                                  ▼
                                            IB Gateway ──TCP──► IBKR Servers
                                                  │
                                        (async callback)
                                                  │
                                                  ▼
                                        IbkrCallbackHandler.orderStatus()
                                                  │
                                                  ▼
                                        OMS.onFill() / OMS.onOrderStatus()
                                          ├──► Position.applyFill()
                                          ├──► RedisState.saveOrder()
                                          ├──► RedisState.savePosition()
                                          └──► UI push (order + position)
```

### 4.3 Strategy Signal Flow

```
TickRouter.onTick()
      │
      ▼
StrategyEngine.onTick()
      │
      ├── for each active Strategy:
      │     │
      │     ▼
      │   strategy.onTick(tick) → Signal | null
      │     │
      │     └── if Signal:
      │           │
      │           ▼
      │     signal.toOrder() → Order
      │           │
      │           ▼
      │     OMS.submitOrder(order)
      │           │
      │           └── (follows Order Execution flow above)
      │
      └── (no signal: return to next tick)
```

---

## 5. Deployment & Performance Tuning (macOS + Docker)

### 5.1 Container Runtime

| Runtime          | Status       | Notes                                   |
|:-----------------|:-------------|:----------------------------------------|
| **OrbStack**     | **Primary**  | Near-native I/O, ~150MB idle RAM, 2-5s startup |
| Docker Desktop   | Fallback     | Requires VirtioFS enabled, ~600MB+ idle RAM    |

### 5.2 I/O Storage (QuestDB)

QuestDB needs ≥16,000 IOPS and ≥1GB/s throughput to capture heavy options chain data without dropping ticks.

- **Named volumes** (`questdb_data`) are used instead of bind mounts for better I/O performance through the virtualization layer
- **VirtioFS** (if Docker Desktop) must be enabled — default `gRPC FUSE` is far too slow
- **OrbStack** uses a custom optimized file-sharing layer that outperforms both

### 5.3 Network Latency (IB Gateway)

- Custom bridge network `quantstation-net` with fixed subnet (`172.18.0.0/16`) for deterministic container IPs
- MTU sizes matched to prevent packet fragmentation
- All inter-container traffic stays on the virtual bridge — no host NAT traversal

### 5.4 Memory Mapping (QuestDB)

- Docker VM allocated 8GB dedicated to QuestDB for effective memory-mapped file buffering
- WAL (Write-Ahead Log) enabled on all tables for crash recovery
- `cairo.max.uncommitted.rows=500000` allows large buffer before forced commit

---

## 6. Transition Plan: IBKR → Massive.com (ex-Polygon.io)

### 6.1 Current State

Spring Boot subscribes to market data ticks via the IB API wrapper communicating with the local IB Gateway container. IB Gateway handles **both** execution and market data.

### 6.2 Future State

Decoupled dual-pipe architecture:

```
┌────────────────┐                    ┌────────────────┐
│  Massive.com    │ ◄── WebSocket ──► │  Data Plane    │
│  (Market Data)  │                    │  TickRouter    │
└────────────────┘                    └───────┬────────┘
                                              │
                                              ▼
                                    ┌────────────────┐
                                    │  Strategy +    │
                                    │  Redis + QDB   │
                                    └───────┬────────┘
                                            │
                                            ▼
┌────────────────┐                    ┌────────────────┐
│  IBKR Servers   │ ◄── TCP ───────► │  Execution     │
│  (Orders Only)  │                    │  Plane (OMS)   │
└────────────────┘                    └────────────────┘
```

### 6.3 Implementation Strategy

The `MarketDataProvider` interface enables hot-swappable data sources:

1. `IbkrMarketDataAdapter` — Active on `default`, `paper`, `live` profiles
2. `MassiveStreamClient` — Active on `massive` profile

**Transition steps:**
1. Set `spring.profiles.active=massive`
2. Set `MASSIVE_API_KEY` environment variable
3. The `MarketDataProvider` bean swaps automatically via Spring `@Profile`
4. Zero changes to the Execution Plane — `OMS`, `RiskManager`, `IbkrOrderRouter` remain untouched
5. IB Gateway is strictly relegated to order routing and account queries

**Benefit:** Isolates the execution loop from data-feed congestion. A sudden surge in market volatility (which spikes tick volume) will never delay outbound trade execution packets.

---

## 7. Supplementary Data: Alpha Vantage

| Property          | Value                                    |
|:------------------|:-----------------------------------------|
| **API**           | REST (`https://www.alphavantage.co/query`) |
| **Rate Limit**    | 5 requests/minute (free tier)            |
| **Cache**         | Redis with configurable TTL (default 60m) |

**Provides:**
- Fundamental data (earnings, balance sheet, cash flow)
- Historical end-of-day OHLCV (stored in `eod_prices` table)
- Technical indicators (SMA, EMA, RSI)
- Economic indicators

---

## 8. Port Mapping Reference

| Service               | Port   | Protocol  | Network              | Purpose              |
|:----------------------|:-------|:----------|:---------------------|:---------------------|
| Spring Boot           | `8080` | HTTP/WS   | Host                 | REST API + STOMP WS  |
| Spring Boot Actuator  | `8081` | HTTP      | Host                 | Health, metrics      |
| QuestDB Web Console   | `9000` | HTTP      | Host + Docker bridge | Admin/debug          |
| QuestDB ILP           | `9009` | TCP       | Host + Docker bridge | Tick ingestion       |
| QuestDB PG Wire       | `8812` | TCP       | Host + Docker bridge | SQL queries          |
| Redis                 | `6379` | TCP       | Host + Docker bridge | State read/write     |
| IB Gateway Paper      | `4002` | TCP       | Host + Docker bridge | Paper trading API    |
| IB Gateway Live       | `4001` | TCP       | Host + Docker bridge | Live trading API     |
| IB Gateway VNC        | `5900` | TCP       | Host                 | Debug GUI (optional) |

---

## 9. Risk Parameters (Configurable)

| Parameter                    | Default    | Config Key                               |
|:-----------------------------|:-----------|:-----------------------------------------|
| Max position size per symbol | 100 units  | `quantstation.risk.max-position-size`    |
| Max daily loss               | $5,000     | `quantstation.risk.max-daily-loss`       |
| Max single order value       | $50,000    | `quantstation.risk.max-order-value`      |
| Confirmation threshold       | $10,000    | `quantstation.risk.require-confirmation-above` |

**Live profile** overrides confirmation threshold to $5,000.

---

## 10. Non-Functional Requirements

| Requirement         | Target                              |
|:--------------------|:------------------------------------|
| Tick-to-UI latency  | ≤ 5ms (loopback)                   |
| QuestDB write IOPS  | ≥ 16,000                           |
| QuestDB throughput   | ≥ 1GB/s sequential write           |
| Redis latency        | ≤ 1ms per operation                |
| UI push cadence      | 50ms (20 FPS tick updates)         |
| QuestDB flush cadence| 100ms batch writes                 |
| Docker idle RAM      | ≤ 300MB (OrbStack)                 |
| Reconnection         | Auto-reconnect with 3s backoff, 10 attempts |

---

## Appendix A: Technology Stack

| Layer           | Technology                         | Version    |
|:----------------|:-----------------------------------|:-----------|
| JVM             | Java (Temurin)                     | 21 LTS     |
| Backend         | Spring Boot                        | 3.4.1      |
| Build           | Gradle (Kotlin DSL)                | 9.x        |
| Desktop         | Electron                           | 33.x       |
| UI              | React                              | 19.x       |
| UI Build        | electron-vite (Vite 6)             | 2.4.x      |
| Language        | TypeScript                         | 5.6.x      |
| State           | Zustand                            | 5.x        |
| Charting        | TradingView Lightweight Charts     | 4.2.x      |
| WS Client       | @stomp/stompjs                    | 7.x        |
| Redis           | Redis (Alpine)                     | 7.x        |
| Time-Series DB  | QuestDB                            | 8.2.x      |
| IB Gateway      | gnzsnz/ib-gateway                  | latest     |
| Container       | OrbStack (primary)                 | latest     |
| Package Mgr     | pnpm (frontend)                    | latest     |
