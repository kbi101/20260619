# 005 Multi-Resolution Signal Engine — Implementation Details

## Status
- [x] **Timeframe Resampler (`TimeframeResampler.java`)** — Implemented 1m bar aggregation into 2m, 5m, 15m, 30m, 1h, and 4h OHLCV buckets. (Completed)
- [x] **Indicator Calculator (`IndicatorCalculator.java`)** — Implemented rolling Z-Score, RSI(14), ADX(14), MACD(12,26,9), and Volatility Regime calculation. (Completed)
- [x] **Symbol-Tuned Spec Registry (`MultiResolutionSpecRegistry.java`)** — Ported 119 symbol & timeframe-specific SHACL target policies from `target_rules.ttl` with sector inheritance for Consumer Staples constituents (`WMT`, `KO`, `KMB`, `TGT`, `PG`, `COST`, `PEP`). (Completed)
- [x] **Multi-Resolution Strategy (`MultiResolutionStrategy.java`)** — Multi-timeframe signal matrix evaluation, consensus rule derivation (`BULLISH_CONSENSUS`, `BEARISH_CONSENSUS`, `FILTERED_OVERSOLD`), and automated order dispatching to OMS. (Completed)
- [x] **Scenario Simulation Engine (`MultiResolutionSimService.java`)** — Synthetic market bar generator supporting preset scenarios (`BULLISH_OVERSOLD`, `OVERBOUGHT_RALLY`, `VOLATILITY_SHOCK`, `NEUTRAL_RESET`). (Completed)
- [x] **Report & REST Controller (`MultiResolutionReportService.java`, `MultiResolutionController.java`)** — REST endpoints for matrix, report generation, and simulation injection. (Completed)
- [x] **Strategy Engine Auto-Registration (`StrategyEngine.java`)** — Auto-registered Spring-managed strategy beans and added `onBar` event dispatching. (Completed)
- [x] **UI Matrix Widget & Simulator Panel (`MultiResolutionMatrixWidget.tsx`, `MultiResolutionSimulatorPanel.tsx`)** — Intel Dashboard consensus matrix widget with toggleable simulation control toolbar, real-time tick streaming, and audit console. (Completed)

---

## 1. Core Architecture Details

### Java 21 Backend Classes

1. **`TimeframeResampler.java`**:
   - Location: `core-engine/src/main/java/com/quantstation/strategy/multiresolution/TimeframeResampler.java`
   - Resamples 1-minute `BarData` into 2m, 5m, 15m, 30m, 1h, 4h bar lists using epoch-minute bucketing.

2. **`IndicatorCalculator.java`**:
   - Location: `core-engine/src/main/java/com/quantstation/strategy/multiresolution/IndicatorCalculator.java`
   - Computes rolling Z-Score over 20 bars, Wilder's RSI(14), ADX(14), MACD(12,26,9) Histogram, and Volatility Regime.

3. **`MultiResolutionStrategy.java`**:
   - Location: `core-engine/src/main/java/com/quantstation/strategy/multiresolution/MultiResolutionStrategy.java`
   - Evaluates multi-timeframe consensus (`buyCount >= 3` $\to$ `BULLISH_CONSENSUS`, `sellCount >= 2` $\to$ `BEARISH_CONSENSUS`) and dispatches automated signals to OMS.

4. **`MultiResolutionSimService.java`**:
   - Location: `core-engine/src/main/java/com/quantstation/strategy/multiresolution/MultiResolutionSimService.java`
   - Generates synthetic 1m bar streams to simulate market scenarios offline.

5. **`MultiResolutionController.java`**:
   - Location: `core-engine/src/main/java/com/quantstation/web/MultiResolutionController.java`
   - Endpoints:
     - `GET /api/v1/signals/multi-resolution`
     - `GET /api/v1/signals/multi-resolution/report`
     - `POST /api/v1/signals/multi-resolution/simulate?symbol={sym}&scenario={type}`

---

## 2. Frontend Components

1. **`MultiResolutionMatrixWidget.tsx`**:
   - Location: `workspace-ui/src/components/intel/MultiResolutionMatrixWidget.tsx`
   - Displays real-time 6-timeframe matrix table, consensus badges, expandable indicator metrics, and a **🧪 Simulator** toggle button.

2. **`MultiResolutionSimulatorPanel.tsx`**:
   - Location: `workspace-ui/src/components/intel/MultiResolutionSimulatorPanel.tsx`
   - Renders preset buttons (🚀 Bullish Oversold, 📉 Overbought Rally, ⚠️ Volatility Shock, 🔍 Neutral Reset), target symbol selector, play/pause real-time tick streaming, and live execution audit console.

---

## File Manifest

| File | Type | Description |
|:---|:---|:---|
| [TimeframeResampler.java](file:///Users/kepingbi/20260619/quantstation/core-engine/src/main/java/com/quantstation/strategy/multiresolution/TimeframeResampler.java) | New | 1m to 2m/5m/15m/30m/1h/4h bar resampler |
| [IndicatorCalculator.java](file:///Users/kepingbi/20260619/quantstation/core-engine/src/main/java/com/quantstation/strategy/multiresolution/IndicatorCalculator.java) | New | Technical indicator math engine (Z-score, RSI, ADX, MACD, Regime) |
| [MultiResolutionSpec.java](file:///Users/kepingbi/20260619/quantstation/core-engine/src/main/java/com/quantstation/strategy/multiresolution/MultiResolutionSpec.java) | New | Per-symbol & timeframe strategy parameters |
| [MultiResolutionStrategy.java](file:///Users/kepingbi/20260619/quantstation/core-engine/src/main/java/com/quantstation/strategy/multiresolution/MultiResolutionStrategy.java) | New | Core strategy evaluating consensus and emitting automated orders |
| [MultiResolutionSimService.java](file:///Users/kepingbi/20260619/quantstation/core-engine/src/main/java/com/quantstation/strategy/multiresolution/MultiResolutionSimService.java) | New | Synthetic scenario bar generator for simulation |
| [MultiResolutionReportService.java](file:///Users/kepingbi/20260619/quantstation/core-engine/src/main/java/com/quantstation/strategy/multiresolution/MultiResolutionReportService.java) | New | Markdown report and JSON payload generator |
| [MultiResolutionController.java](file:///Users/kepingbi/20260619/quantstation/core-engine/src/main/java/com/quantstation/web/MultiResolutionController.java) | Modify | Added `POST /simulate` endpoint |
| [StrategyEngine.java](file:///Users/kepingbi/20260619/quantstation/core-engine/src/main/java/com/quantstation/strategy/StrategyEngine.java) | Modify | Auto-registers Strategy beans & dispatches `onBar` events |
| [MultiResolutionMatrixWidget.tsx](file:///Users/kepingbi/20260619/quantstation/workspace-ui/src/components/intel/MultiResolutionMatrixWidget.tsx) | Modify | Integrated simulator toggle button and container |
| [MultiResolutionSimulatorPanel.tsx](file:///Users/kepingbi/20260619/quantstation/workspace-ui/src/components/intel/MultiResolutionSimulatorPanel.tsx) | New | Simulator toolbar with presets, streaming tick controls, and audit console |
| [IntelDashboard.tsx](file:///Users/kepingbi/20260619/quantstation/workspace-ui/src/components/intel/IntelDashboard.tsx) | Modify | Layout embedding MultiResolutionMatrixWidget |
| [target_rules.ttl](file:///Users/kepingbi/20260619/quantstation/core-engine/src/main/resources/ontologies/target_rules.ttl) | New | Original SHACL target rules Turtle ontology source file |
| [sync-ttl-rules.py](file:///Users/kepingbi/20260619/quantstation/scripts/sync-ttl-rules.py) | New | Python hot-reload script to push updated TTL target rules to backend |
| [005-multi-resolution-signal-engine.md](file:///Users/kepingbi/20260619/docs/spec/005-multi-resolution-signal-engine.md) | Modify | Technical Specification document updated with Section 5 |
| [005-multi-resolution-signal-engine-impl.md](file:///Users/kepingbi/20260619/docs/impl/005-multi-resolution-signal-engine-impl.md) | Modify | Implementation Details document updated |

---

## Verification Results

### Backend Unit Tests (`core-engine`)
Command:
```bash
./gradlew test
```
Outputs:
- `TimeframeResamplerTest`: PASSED
- `IndicatorCalculatorTest`: PASSED
- `MultiResolutionStrategyTest`: PASSED
- `MultiResolutionSimServiceTest`: PASSED
- **BUILD SUCCESSFUL**

### Frontend TypeScript Verification (`workspace-ui`)
Command:
```bash
pnpm exec tsc --noEmit
```
Outputs: **0 compilation errors**
