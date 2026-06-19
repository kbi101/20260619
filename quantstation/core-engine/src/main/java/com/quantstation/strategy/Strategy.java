package com.quantstation.strategy;

import com.quantstation.domain.BarData;
import com.quantstation.domain.Tick;
import com.quantstation.strategy.signals.Signal;

/**
 * Base interface for algorithmic trading strategies.
 *
 * <p>Strategies receive market data events and produce trading signals.
 * The StrategyEngine manages strategy lifecycle and dispatches events.
 *
 * <p>Implementation guidelines:
 * <ul>
 *   <li>Keep {@code onTick} lightweight — it's called on the hot path</li>
 *   <li>Use {@code onBar} for computationally heavier logic</li>
 *   <li>Return null from signal methods if no action needed</li>
 * </ul>
 */
public interface Strategy {

    /**
     * Unique name for this strategy instance.
     */
    String getName();

    /**
     * Called on every incoming tick for subscribed symbols.
     *
     * @param tick The incoming market tick
     * @return A trading signal, or null if no action
     */
    Signal onTick(Tick tick);

    /**
     * Called when a new bar (candle) completes.
     *
     * @param bar The completed bar data
     * @return A trading signal, or null if no action
     */
    Signal onBar(BarData bar);

    /**
     * Called when an order fill is received.
     *
     * @param symbol    The filled symbol
     * @param fillQty   Quantity filled
     * @param fillPrice Fill price
     */
    default void onFill(String symbol, double fillQty, double fillPrice) {
        // Default: no-op
    }

    /**
     * Initialize strategy with parameters.
     */
    default void initialize() {
        // Default: no-op
    }

    /**
     * Cleanup when strategy is stopped.
     */
    default void shutdown() {
        // Default: no-op
    }

    /**
     * Returns true if this strategy is currently active.
     */
    boolean isActive();

    /**
     * Get the symbols this strategy is interested in.
     */
    java.util.Set<String> getSubscribedSymbols();
}
