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
     * Functional interface for tick callbacks.
     */
    @FunctionalInterface
    interface TickListener {
        void onTick(Tick tick);
    }
}
