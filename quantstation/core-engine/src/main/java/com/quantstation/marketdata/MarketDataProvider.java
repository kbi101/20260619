package com.quantstation.marketdata;

import com.quantstation.domain.Tick;

/**
 * Strategy pattern interface for market data providers.
 *
 * <p>Implementations:
 * <ul>
 *   <li>{@code IbkrMarketDataAdapter} — Current: IBKR via IB Gateway</li>
 *   <li>{@code MassiveStreamClient} — Future: Massive.com (ex-Polygon.io) WebSocket</li>
 * </ul>
 *
 * <p>Swapping providers requires only changing the active Spring profile
 * and bean configuration — zero changes to the execution plane.
 */
public interface MarketDataProvider {

    /**
     * Subscribe to real-time market data for a symbol.
     */
    void subscribe(String symbol);

    /**
     * Unsubscribe from market data for a symbol.
     */
    void unsubscribe(String symbol);

    /**
     * Subscribe to high-precision real-time charting market data for a symbol.
     */
    default void subscribeChart(String symbol) {}

    /**
     * Unsubscribe from high-precision real-time charting market data for a symbol.
     */
    default void unsubscribeChart(String symbol) {}

    /**
     * Set the callback for incoming ticks.
     */
    void setTickListener(TickListener listener);

    /**
     * Check if this provider is currently connected.
     */
    boolean isConnected();

    /**
     * Get the provider name for logging/monitoring.
     */
    String getProviderName();

    /**
     * Fetch historical bars from the provider.
     */
    java.util.concurrent.CompletableFuture<java.util.List<com.quantstation.domain.BarData>> fetchHistoricalBars(
            String symbol, String duration, String barSize);

    /**
     * Get last known tick for a symbol (if available).
     */
    default Tick getLastTick(String symbol) {
        return null;
    }

    /**
     * Get all last known ticks.
     */
    default java.util.Map<String, Tick> getLastTicks() {
        return java.util.Map.of();
    }

    /**
     * Functional interface for tick callbacks.
     */
    @FunctionalInterface
    interface TickListener {
        void onTick(Tick tick);
    }
}
