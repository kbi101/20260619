# 004 Order Book Analytics — Implementation Details

## Status
- [x] **State Store (`useStore.ts`)** — Integrate settings, rolling imbalance buffers, and computed metrics. (Completed)
- [x] **Calculation Pipeline (`OrderBook.tsx`)** — Implement decay weight factors, EMA smoothing, and standard deviation calculations. (Completed)
- [x] **Iceberg/Hidden Volume Detection** — Mitigated on the client-side by comparing execution trade size against Level 1 & Level 2 book depletion deltas. (Completed)
- [x] **FIFO Queue Component** — Implemented client-side position estimation on the Order Blotter using Level 2 depth sizes and Level 1 trade size execution deltas. (Completed)
- [x] **UI Analytics Panel (`OrderBook.tsx`)** — Render the horizontal bar, persistence LED, and settings sliders. (Completed)
- [x] **Disabled Level 2 Simulation Overlay** — Disabled simulated Level 2 order book and added a glassmorphic "Level 2 Offline" overlay blocking interaction until actual IBKR Market Depth API (`reqMktDepth`) is integrated. (Completed)

---

## Proposed Implementation Details

### 1. State Store Integration
**File:** `workspace-ui/src/store/useStore.ts`
We will extend the Zustand state interface to maintain:
```typescript
interface ObiState {
  decayAlpha: number;     // α parameter (default: 0.8)
  smoothingBeta: number;  // β parameter (default: 0.1)
  imbalanceHistory: number[]; // Sliding window of length K (default: 50)
  smoothedImbalance: number;  // Rolling EMA value
}

// Actions
updateObiSettings: (settings: Partial<ObiState>) => void;
pushImbalanceValue: (val: number) => void;
```

---

### 2. Math Calculations & Sliding Window
**File:** `workspace-ui/src/components/orderbook/OrderBook.tsx`
Calculations will execute on every tick/depth change:
1. **Decay Weights:**
   ```typescript
   let weightedBids = 0;
   let weightedAsks = 0;
   bids.forEach((level, i) => {
     weightedBids += level.size * Math.pow(decayAlpha, i);
   });
   asks.forEach((level, i) => {
     weightedAsks += level.size * Math.pow(decayAlpha, i);
   });
   ```
2. **EMA Calculation:**
   ```typescript
   const rawImbalance = (weightedBids - weightedAsks) / (weightedBids + weightedAsks);
   const nextSmoothed = (smoothingBeta * rawImbalance) + ((1 - smoothingBeta) * previousSmoothed);
   ```
3. **Standard Deviation:**
   Compute standard deviation over the rolling `imbalanceHistory` array in JavaScript:
   ```typescript
   const mean = history.reduce((a, b) => a + b, 0) / history.length;
   const variance = history.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / history.length;
   const stdDev = Math.sqrt(variance);
   ```

---

### 3. UI Analytics Panel Component
**File:** `workspace-ui/src/components/orderbook/OrderBook.tsx`
The panel will render at the bottom of the order book panel using standard flex/grid CSS variables matching the theme:

```tsx
<div className="orderbook__analytics">
  <div className="obi-meter">
    <div className="obi-meter__fill-ask" style={{ width: `${askPct}%` }} />
    <div className="obi-meter__fill-bid" style={{ width: `${bidPct}%` }} />
    <div className="obi-meter__needle" style={{ left: `${needlePos}%` }} />
  </div>
  <div className="obi-stats">
    <span>Vol: {rawBids} vs {rawAsks}</span>
    <span>Weighted: {weightedBids.toFixed(0)} vs {weightedAsks.toFixed(0)}</span>
  </div>
  <div className="obi-spoof-indicator">
    <span className={`pulse-dot pulse-dot--${volatilityStatus}`} />
    <span>PERSISTENCE: {volatilityStatus.toUpperCase()} (σ: {stdDev.toFixed(2)})</span>
  </div>
</div>
```

---

## File Manifest

| File | Type | Description |
|---|---|---|
| `workspace-ui/src/store/useStore.ts` | Modify | Add OBI parameter states, actions, and history buffers |
| `workspace-ui/src/components/orderbook/OrderBook.tsx` | Modify | Add decay/EMA logic, sliding standard deviation calculation, and rendering |
| `docs/spec/004-order-book-analytics.md` | New | Technical Specification |
| `docs/impl/004-order-book-analytics-impl.md` | New | Implementation details documentation |

---

## Verification Plan

### Automated Tests
- Implement unit tests for:
  - Decay weight multipliers (verify weight decays properly).
  - EMA smoothing (verify inertia on noisy inputs).
  - Standard deviation helper (verify standard math results).

### Manual Verification
- Render the metrics on screen, toggle symbol feeds, and verify that the imbalance meter slides smoothly.
- Simulate spoofing (generate block order spikes in ticks/depth) and verify that the persistence LED switches to Red.
