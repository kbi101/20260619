# 004 Order Book Analytics — Technical Specification

## Overview
Traders require real-time micro-structural signals derived from the Limit Order Book (Level 2 data) and executed trade streams (Level 1 data) to predict short-term price direction. This specification outlines the calculation of Order Book Imbalance (OBI), Volume-Weighted Imbalance, Hidden Volume (Iceberg) detection, and FIFO Queue Position Estimation.

---

## 1. Mathematical Formulations

### 1.1 Simple Order Book Imbalance
Calculates the raw ratio of total limit buy orders (bids) compared to total limit sell orders (asks) across all visible levels of the book.

$$\text{Total Bid Volume } (V_{\text{bids}}) = \sum_{i=1}^{N} \text{Size}_{\text{bid}, i}$$
$$\text{Total Ask Volume } (V_{\text{asks}}) = \sum_{i=1}^{N} \text{Size}_{\text{ask}, i}$$
$$\text{Simple Imbalance } (I_{\text{simple}}) = \frac{V_{\text{bids}} - V_{\text{asks}}}{V_{\text{bids}} + V_{\text{asks}}}$$

* **Scale:** Range $[-1.0, +1.0]$. 
  * $+1.0$ indicates 100% buy orders (bullish buyer dominance).
  * $-1.0$ indicates 100% sell orders (bearish seller dominance).

---

### 1.2 Volume-Weighted Imbalance
To account for the fact that orders closer to the mid-price have a higher execution probability, a rank-based decay factor is applied to both sides.

For each level $i$ (where $i=1$ is the best bid/ask, $i=2$ is the second best, etc.):

$$\text{Weight } W(i) = \alpha^{i-1}$$

* $\alpha$ is the **decay factor** (default: $0.8$).
* **Weighted Volumes:**

$$WV_{\text{bids}} = \sum_{i=1}^{N} \text{Size}_{\text{bid}, i} \cdot \alpha^{i-1}$$
$$WV_{\text{asks}} = \sum_{i=1}^{N} \text{Size}_{\text{ask}, i} \cdot \alpha^{i-1}$$
$$I_{\text{weighted}} = \frac{WV_{\text{bids}} - WV_{\text{asks}}}{WV_{\text{bids}} + WV_{\text{asks}}}$$

---

### 1.3 Exponential Moving Average (EMA) Smoothing
To prevent microsecond tick noise from creating false signals, the weighted imbalance is smoothed using a rolling coefficient:

$$I_{\text{smooth}, t} = \beta \cdot I_{\text{weighted}, t} + (1 - \beta) \cdot I_{\text{smooth}, t-1}$$

* $\beta$ is the **smoothing factor** (default: $0.1$).

---

### 1.4 Volatility / Spoof Alert Index
High-frequency spoofing is characterized by rapid, large size updates on one side of the book without execution. We calculate the rolling **Standard Deviation ($\sigma$)** of the raw imbalance over the last $K$ updates (default: $K = 50$).

$$\sigma = \sqrt{\frac{1}{K} \sum_{j=1}^{K} (I_{\text{weighted}, j} - \bar{I})^2}$$

* **Stable ($\sigma < 0.15$):** Low volatility. Order book updates represent authentic structural builds.
* **Transitioning ($0.15 \le \sigma < 0.35$):** Normal shifting liquidity.
* **Potential Spoof ($\sigma \ge 0.35$):** High-velocity order addition/cancellation. Warns the trader of possible manipulation.

---

## 2. Micro-structural Reconstructions (Dealing with Missing Level 3)

### 2.1 Hidden Volume (Iceberg) Detection
Since Level 2 only displays aggregated sizes, hidden orders must be inferred by comparing trade executions with order book depletion:

$$\text{Hidden Volume } (V_{\text{hidden}}) = \max\left(0, \text{Executed Trades Volume} - (S_{t-1} - S_t)\right)$$

* Where $S_{t-1}$ is the previous visible size at the target price, and $S_t$ is the current visible size.
* If a high volume executes but the visible depth remains stable or drops less than expected, an iceberg order is active.

### 2.2 FIFO Queue Position Estimation
When a limit order is submitted, the queue ahead of us is estimated using the first-in-first-out logic:
1. Record the initial visible depth $S_{\text{start}}$ at the limit price.
2. Any newly added depth is placed at the back of the queue (behind us).
3. Any executed trades at our price reduce the depth in front of us.
4. **Estimated Queue Position:**

$$Q_t = \max\left(0, S_{\text{start}} - \text{Cumulative Executed Volume since submission}\right)$$

---

## 3. UI/UX Specifications

### 3.1 Display Layout
The Order Book component will render an **Analytics Panel** at the bottom with:
1. **OBI Progress Meter:** Dual-color progress bar (Red/Green) indicating the location of $I_{\text{smooth}}$.
2. **Persistence State LED:** High-contrast dot indicating stable (Green), transitioning (Yellow), or spoofing alert (Red).
3. **Data Grid:**
   * Raw Ask/Bid totals.
   * Weighted Ask/Bid volumes.
   * Persistence/Spoof value ($\sigma$).

### 3.2 Controls
* Sliders/inputs to adjust:
  * Decay factor $\alpha$ (range: $0.1 - 1.0$)
  * Smoothing factor $\beta$ (range: $0.01 - 0.5$)
