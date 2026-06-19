package com.quantstation.domain;

import java.time.Instant;

/**
 * Immutable market data tick.
 *
 * <p>Represents a single trade or quote event from the market data feed.
 * Used throughout the Data Fabric for fan-out to Redis, QuestDB, and the Strategy engine.
 *
 * @param symbol     Ticker symbol (e.g., "AAPL", "SPY")
 * @param price      Trade/quote price
 * @param size       Trade size (number of shares/contracts)
 * @param exchange   Exchange code where the trade occurred
 * @param conditions Trade condition flags
 * @param bidPrice   Current best bid (for quotes)
 * @param askPrice   Current best ask (for quotes)
 * @param bidSize    Best bid size
 * @param askSize    Best ask size
 * @param timestamp  Exchange timestamp of the event
 */
public record Tick(
        String symbol,
        double price,
        int size,
        String exchange,
        String conditions,
        double bidPrice,
        double askPrice,
        int bidSize,
        int askSize,
        Instant timestamp
) {
    /**
     * Creates a trade-only tick (no bid/ask).
     */
    public static Tick trade(String symbol, double price, int size,
                             String exchange, Instant timestamp) {
        return new Tick(symbol, price, size, exchange, null,
                0.0, 0.0, 0, 0, timestamp);
    }

    /**
     * Creates a quote-only tick (bid/ask spread).
     */
    public static Tick quote(String symbol, double bidPrice, double askPrice,
                             int bidSize, int askSize, Instant timestamp) {
        double mid = (bidPrice + askPrice) / 2.0;
        return new Tick(symbol, mid, 0, null, null,
                bidPrice, askPrice, bidSize, askSize, timestamp);
    }

    /**
     * Returns the mid-price (average of bid and ask).
     */
    public double midPrice() {
        if (bidPrice > 0 && askPrice > 0) {
            return (bidPrice + askPrice) / 2.0;
        }
        return price;
    }

    /**
     * Returns the spread (ask - bid).
     */
    public double spread() {
        return askPrice - bidPrice;
    }
}
