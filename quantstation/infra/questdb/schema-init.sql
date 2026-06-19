-- ═══════════════════════════════════════════════════════
-- QuantStation — QuestDB Schema Initialization
-- ═══════════════════════════════════════════════════════
-- Time-series tables for market data storage
-- Executed on first container startup
-- ═══════════════════════════════════════════════════════

-- ── Raw Tick Data ────────────────────────────────────
-- Captures every trade tick from the market data feed
CREATE TABLE IF NOT EXISTS ticks (
    symbol SYMBOL capacity 1024 CACHE,
    price DOUBLE,
    size INT,
    exchange SYMBOL capacity 64 CACHE,
    conditions SYMBOL capacity 128 CACHE,
    timestamp TIMESTAMP
) timestamp(timestamp) PARTITION BY DAY WAL
DEDUP UPSERT KEYS(symbol, timestamp);

-- ── OHLCV Bars ───────────────────────────────────────
-- Aggregated candlestick bars (1m, 5m, 15m, etc.)
CREATE TABLE IF NOT EXISTS ohlcv (
    symbol SYMBOL capacity 1024 CACHE,
    timeframe SYMBOL capacity 16 CACHE,
    open DOUBLE,
    high DOUBLE,
    low DOUBLE,
    close DOUBLE,
    volume LONG,
    vwap DOUBLE,
    trade_count INT,
    bar_start TIMESTAMP,
    bar_end TIMESTAMP,
    timestamp TIMESTAMP
) timestamp(timestamp) PARTITION BY MONTH WAL;

-- ── Options Chain Snapshots ──────────────────────────
-- Full options chain with Greeks for each underlying
CREATE TABLE IF NOT EXISTS options_chain (
    underlying SYMBOL capacity 256 CACHE,
    contract_symbol SYMBOL capacity 4096 CACHE,
    strike DOUBLE,
    expiry TIMESTAMP,
    call_put SYMBOL capacity 2 CACHE,
    bid DOUBLE,
    ask DOUBLE,
    last DOUBLE,
    mid DOUBLE,
    volume INT,
    open_interest INT,
    iv DOUBLE,
    delta DOUBLE,
    gamma DOUBLE,
    theta DOUBLE,
    vega DOUBLE,
    rho DOUBLE,
    timestamp TIMESTAMP
) timestamp(timestamp) PARTITION BY DAY WAL;

-- ── Order Audit Trail ────────────────────────────────
-- Immutable log of all order state transitions
CREATE TABLE IF NOT EXISTS order_audit (
    order_id SYMBOL capacity 4096 CACHE,
    symbol SYMBOL capacity 1024 CACHE,
    side SYMBOL capacity 4 CACHE,
    order_type SYMBOL capacity 16 CACHE,
    quantity DOUBLE,
    price DOUBLE,
    filled_quantity DOUBLE,
    avg_fill_price DOUBLE,
    status SYMBOL capacity 16 CACHE,
    message STRING,
    timestamp TIMESTAMP
) timestamp(timestamp) PARTITION BY MONTH WAL;

-- ── PnL Snapshots ────────────────────────────────────
-- Periodic snapshots of portfolio PnL for historical analysis
CREATE TABLE IF NOT EXISTS pnl_snapshots (
    account SYMBOL capacity 16 CACHE,
    unrealized_pnl DOUBLE,
    realized_pnl DOUBLE,
    total_pnl DOUBLE,
    net_liquidation DOUBLE,
    buying_power DOUBLE,
    timestamp TIMESTAMP
) timestamp(timestamp) PARTITION BY MONTH WAL;

-- ── Alpha Vantage EOD ────────────────────────────────
-- End-of-day data from Alpha Vantage supplementary feed
CREATE TABLE IF NOT EXISTS eod_prices (
    symbol SYMBOL capacity 2048 CACHE,
    open DOUBLE,
    high DOUBLE,
    low DOUBLE,
    close DOUBLE,
    adjusted_close DOUBLE,
    volume LONG,
    dividend_amount DOUBLE,
    split_coefficient DOUBLE,
    timestamp TIMESTAMP
) timestamp(timestamp) PARTITION BY YEAR WAL;
