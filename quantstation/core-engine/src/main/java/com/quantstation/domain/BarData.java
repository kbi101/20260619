package com.quantstation.domain;

import java.time.Instant;

/**
 * OHLCV bar data aggregation.
 *
 * @param symbol     Ticker symbol
 * @param timeframe  Bar timeframe (e.g., "1m", "5m", "15m", "1h", "1d")
 * @param open       Opening price
 * @param high       Highest price in the bar
 * @param low        Lowest price in the bar
 * @param close      Closing price
 * @param volume     Total volume in the bar
 * @param vwap       Volume-weighted average price
 * @param tradeCount Number of trades in the bar
 * @param barStart   Start time of the bar
 * @param barEnd     End time of the bar
 * @param timestamp  When this bar was created/received
 */
public record BarData(
        String symbol,
        String timeframe,
        double open,
        double high,
        double low,
        double close,
        long volume,
        double vwap,
        int tradeCount,
        Instant barStart,
        Instant barEnd,
        Instant timestamp
) {
    /**
     * Returns the bar range (high - low).
     */
    public double range() {
        return high - low;
    }

    /**
     * Returns the body size (|close - open|).
     */
    public double bodySize() {
        return Math.abs(close - open);
    }

    /**
     * Returns true if this is a bullish (green) bar.
     */
    public boolean isBullish() {
        return close >= open;
    }

    /**
     * Returns the percentage change from open to close.
     */
    public double changePercent() {
        if (open == 0.0) return 0.0;
        return ((close - open) / open) * 100.0;
    }
}
