# 005 Multi-Resolution Signal Engine — Technical Specification

## Overview
This specification details the design and mathematical formulation of the **Multi-Resolution Signal Engine and Automated Trading Trigger System** in QuantStation. The system evaluates real-time market setups across 6 distinct candle resolutions (**2-minute, 5-minute, 15-minute, 30-minute, 1-hour, and 4-hour**) against quantitative mean-reversion rules and momentum filters.

By aggregating signals across multiple resolutions, the engine produces a high-confidence **Multi-Resolution Consensus** recommendation, automatically triggering pre-trade risk validated orders via QuantStation's Order Management System (OMS) when bullish or bearish consensus conditions are met.

---

## 1. Mathematical Formulations

### 1.1 Rolling Z-Score (20-Period Lookback)
Measures how far the current close price $C_t$ has deviated from its 20-period simple moving average $\text{SMA}_{20}$ in units of standard deviation $\sigma_{20}$:

$$\text{SMA}_{20} = \frac{1}{20} \sum_{i=0}^{19} C_{t-i}$$

$$\sigma_{20} = \sqrt{\frac{1}{19} \sum_{i=0}^{19} \left(C_{t-i} - \text{SMA}_{20}\right)^2}$$

$$\text{Z-Score } (Z_t) = \frac{C_t - \text{SMA}_{20}}{\sigma_{20}}$$

* **Oversold Trigger Condition**: $Z_t < -TP_Z$ (Default $TP_Z = 1.5$)
* **Overbought Exit Condition**: $Z_t > +TP_Z$ (Default $TP_Z = 1.5$)

---

### 1.2 Relative Strength Index (RSI - 14 Period)
Calculates price momentum using Wilder's exponential smoothing over price changes $\Delta_t = C_t - C_{t-1}$:

$$U_t = \max(\Delta_t, 0), \quad D_t = \max(-\Delta_t, 0)$$

$$\text{AvgGain}_t = \frac{\text{AvgGain}_{t-1} \cdot 13 + U_t}{14}$$

$$\text{AvgLoss}_t = \frac{\text{AvgLoss}_{t-1} \cdot 13 + D_t}{14}$$

$$\text{RS}_t = \frac{\text{AvgGain}_t}{\text{AvgLoss}_t}$$

$$\text{RSI}_t = 100 - \frac{100}{1 + \text{RS}_t}$$

* **Filter Guardrail**: $\text{RSI}_t \le \text{MaxRSI}$ (Default $\text{MaxRSI} = 70.0$)

---

### 1.3 Average Directional Index (ADX - 14 Period)
Quantifies trend strength independent of direction:

$$\text{TR}_t = \max\left(H_t - L_t, \, |H_t - C_{t-1}|, \, |L_t - C_{t-1}|\right)$$

$$+DM_t = (H_t - H_{t-1} > L_{t-1} - L_t \text{ and } H_t - H_{t-1} > 0) \ ? \ (H_t - H_{t-1}) : 0$$

$$-DM_t = (L_{t-1} - L_t > H_t - H_{t-1} \text{ and } L_{t-1} - L_t > 0) \ ? \ (L_{t-1} - L_t) : 0$$

Smoothed using Wilder's EMA:

$$+DI_{14} = 100 \cdot \frac{\text{EMA}_{14}(+DM)}{\text{EMA}_{14}(\text{TR})}, \quad -DI_{14} = 100 \cdot \frac{\text{EMA}_{14}(-DM)}{\text{EMA}_{14}(\text{TR})}$$

$$\text{DX} = 100 \cdot \frac{|+DI_{14} - -DI_{14}|}{+DI_{14} + -DI_{14}}$$

$$\text{ADX} = \text{EMA}_{14}(\text{DX})$$

* **Filter Guardrail**: $\text{ADX}_t \le \text{MaxADX}$ (Default $\text{MaxADX} = 40.0$)

---

### 1.4 MACD Histogram (12, 26, 9)
Evaluates moving average convergence divergence momentum:

$$\text{MACD Line} = \text{EMA}_{12}(C) - \text{EMA}_{26}(C)$$

$$\text{Signal Line} = \text{EMA}_9(\text{MACD Line})$$

$$\text{MACD Hist} = \text{MACD Line} - \text{Signal Line}$$

* **Filter Guardrail**: $\text{MACD Hist} > 0$ when `requireMacdBullish` is enabled.

---

### 1.5 Volatility Regime Filter
Computes rolling standard deviation of 1-minute percentage returns $R_t = \frac{C_t - C_{t-1}}{C_{t-1}}$ over 20 bars:

$$\sigma_R = \sqrt{\frac{1}{20} \sum_{i=0}^{19} (R_{t-i} - \bar{R})^2}$$

* **Low Volatility State (0)**: $\sigma_R \le 0.0035$ (Normal trading conditions)
* **High Volatility State (1)**: $\sigma_R > 0.0035$ (Volatile spike / news shock)
* **Filter Guardrail**: Trades are permitted only when $\text{Regime} = 0$ (LowVol).

---

### 1.6 Symbol-Tuned SHACL Target Policy Matrix (`target_rules.ttl`)
Rather than relying solely on global defaults, QuantStation integrates 119 symbol and timeframe-specific target policies (`MultiResolutionSpecRegistry.java`) ported directly from `target_rules.ttl`. Sector constituent stocks (`WMT`, `KO`, `KMB`, `TGT`, `PG`, `COST`, `PEP`) automatically inherit sector policies (`XLP`):

| Symbol | Resolution | $TP_Z$ | $SL_Z$ | Max RSI | Max ADX | Require MACD Bullish | Use Volatility Regime Filter |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **SPY** | `15m` | `1.1` | `0.8` | `32.5` | — | False | True |
| **SPY** | `5m` | `2.6` | `0.7` | `30.0` | — | False | False |
| **QQQ** | `15m` | `0.8` | `0.5` | — | — | False | False |
| **QQQ** | `5m` | `1.2` | `0.9` | — | — | True | False |
| **IWM** | `15m` | `1.0` | `1.8` | — | — | False | True |
| **XLK** | `15m` | `2.2` | `0.7` | — | `17.5` | False | False |
| **XLF** | `15m` | `1.4` | `0.5` | `40.0` | — | False | False |
| **XLP / Staples** | `15m` | `2.3` | `0.9` | — | `30.0` | False | True |
| **XLB** | `15m` | `1.1` | `1.1` | — | — | True | True |
| **XLU** | `15m` | `0.8` | `2.3` | `40.0` | `27.5` | False | True |
| **XLRE** | `15m` | `1.4` | `0.6` | `42.5` | `22.5` | False | False |

### 1.7 TTL Rule Synchronization & Dynamic Hot-Reloading Workflow
When `target_rules.ttl` or `base_domain.ttl` is updated:
1. **Dynamic Runtime Hot-Reloading**: Spring Boot exposes `POST /api/v1/signals/multi-resolution/reload-rules`. Sending updated TTL content re-parses all symbol rules into `MultiResolutionSpecRegistry` in memory instantaneously without application restarts.
2. **Synchronization Script**: Developers can run `python3 scripts/sync-ttl-rules.py` to push changes from `src/main/resources/ontologies/target_rules.ttl` into the active engine.

---

## 2. Single-Timeframe Signal Evaluation Matrix

For each timeframe $tf \in \{2m, 5m, 15m, 30m, 1h, 4h\}$:

| Signal Code | Display Badge | Mathematical Trigger Conditions | Action |
|:---|:---|:---|:---|
| **`BUY`** | 🚀 BUY | $(Z_t < -TP_Z) \ \land \ \text{RSI\_OK} \ \land \ \text{ADX\_OK} \ \land \ \text{MACD\_OK} \ \land \ \text{REGIME\_OK}$ | Signal triggered |
| **`FILTERED`** | ⚠️ FILTERED | $(Z_t < -TP_Z) \ \land \ \neg (\text{RSI\_OK} \ \land \ \text{ADX\_OK} \ \land \ \text{MACD\_OK} \ \land \ \text{REGIME\_OK})$ | Setup blocked by filters |
| **`SELL`** | 📉 SELL | $Z_t > +TP_Z$ | Overbought exit trigger |
| **`HOLD`** | 🔍 HOLD | $-TP_Z \le Z_t \le +TP_Z$ | Neutral range |

---

## 3. Multi-Timeframe Consensus Rules & Execution Triggers

The overall consensus recommendation for a symbol is aggregated across all 6 timeframes:

| Consensus Code | Consensus Badge | Trigger Criteria | Automated Action |
|:---|:---|:---|:---|
| **`BULLISH_CONSENSUS`** | 🚀 **STRONG BUY** | $\text{BuyCount} \ge 3$ | **Automated BUY Order**: Submits Limit BUY order (100 shares @ Ask) to OMS |
| **`MILD_BULLISH`** | 🔍 **MILD BUY** | $\text{BuyCount} \ge 1$ | Scaled entry alert / High-priority Watchlist highlight |
| **`BEARISH_CONSENSUS`** | 📉 **STRONG SELL** | $\text{SellCount} \ge 2$ | **Automated SELL Order**: Submits Market SELL / Position Exit order to OMS |
| **`MILD_BEARISH`** | 🔍 **MILD SELL** | $\text{SellCount} = 1$ | Partial position exit / Tighten stop loss |
| **`FILTERED_OVERSOLD`** | ⚠️ **FILTERED OVERSOLD** | $\text{FilteredCount} \ge 2$ | Hold cash; log active indicator filter blockers |
| **`NEUTRAL`** | 🔍 **NEUTRAL** | Otherwise | Hold cash |

---

## 4. Pre-Trade Risk Safety Controls

All automated orders emitted by `MultiResolutionStrategy` must pass `RiskManager` validation:
1. **Max Position Sizing**: Default capped at `100 shares` or `$50,000` gross position value per symbol.
2. **Order Throttle Rate**: Minimum `60 seconds` cooldowm per symbol between automated signal dispatches.
3. **Emergency Disconnect Safety**: If IB Gateway TCP connection is lost, OMS automatically cancels pending limit orders.

---

## 5. Offline & Real-Time Scenario Simulator Specification

To facilitate offline development, strategy validation, and trader simulation when live market data feeds are inactive:

### 5.1 Simulation Controls & Scenario Matrix
The UI incorporates a **Scenario Simulator Panel** (`MultiResolutionSimulatorPanel.tsx`) connected to the Spring Boot endpoint `POST /api/v1/signals/multi-resolution/simulate`:

| Scenario Preset | Simulated Bar Profile | Expected Consensus | Automated Execution Trigger |
|:---|:---|:---|:---|
| 🚀 **Bullish Oversold** | Steep $-2.5\sigma$ price drop, low ADX, low RSI, LowVol regime | `BULLISH_CONSENSUS` | Automated BUY order submitted to OMS |
| 📉 **Overbought Rally** | $+2.5\sigma$ price rally above 20-period SMA | `BEARISH_CONSENSUS` | Automated SELL order submitted to OMS |
| ⚠️ **Volatility Shock** | High return volatility ($\sigma_R > 0.0035$) with low Z-score | `FILTERED_OVERSOLD` | Trade blocked by Volatility Regime filter |
| 🔍 **Neutral Reset** | Random walk noise around 20-period SMA | `NEUTRAL` | Hold cash / no order emitted |

### 5.2 Real-Time Tick Stream Simulation Mode
Traders can toggle **▶ Play Real-Time Stream** mode to emit synthetic bar updates every 2 seconds, demonstrating dynamic live matrix badge transitions and real-time order audit logging.

