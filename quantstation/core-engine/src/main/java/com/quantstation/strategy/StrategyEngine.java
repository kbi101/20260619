package com.quantstation.strategy;

import com.quantstation.domain.Tick;
import com.quantstation.execution.OrderManagementSystem;
import com.quantstation.strategy.signals.Signal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Strategy registry and execution engine.
 *
 * <p>Manages the lifecycle of registered strategies and dispatches
 * market data events to active strategies. When a strategy generates
 * a Signal, it is automatically routed to the OMS for execution.
 */
@Service
public class StrategyEngine {

    private static final Logger log = LoggerFactory.getLogger(StrategyEngine.class);

    private final OrderManagementSystem oms;
    private final List<Strategy> strategies = new CopyOnWriteArrayList<>();

    public StrategyEngine(OrderManagementSystem oms) {
        this.oms = oms;
    }

    /**
     * Register a strategy for tick processing.
     */
    public void registerStrategy(Strategy strategy) {
        strategy.initialize();
        strategies.add(strategy);
        log.info("StrategyEngine: Registered strategy '{}' (symbols: {})",
                strategy.getName(), strategy.getSubscribedSymbols());
    }

    /**
     * Remove and shutdown a strategy.
     */
    public void removeStrategy(String strategyName) {
        strategies.removeIf(s -> {
            if (s.getName().equals(strategyName)) {
                s.shutdown();
                log.info("StrategyEngine: Removed strategy '{}'", strategyName);
                return true;
            }
            return false;
        });
    }

    /**
     * Dispatch a tick to all active strategies interested in this symbol.
     * Called from TickRouter on the hot path — keep lightweight.
     */
    public void onTick(Tick tick) {
        for (Strategy strategy : strategies) {
            if (!strategy.isActive()) continue;
            if (!strategy.getSubscribedSymbols().contains(tick.symbol())) continue;

            try {
                Signal signal = strategy.onTick(tick);
                if (signal != null) {
                    handleSignal(signal);
                }
            } catch (Exception e) {
                log.error("StrategyEngine: Error in strategy '{}' onTick",
                        strategy.getName(), e);
            }
        }
    }

    /**
     * Route a strategy signal to the OMS.
     */
    private void handleSignal(Signal signal) {
        log.info("StrategyEngine: Signal from '{}': {} {} {} qty={} @ {}",
                signal.strategyName(), signal.side(), signal.symbol(),
                signal.orderType(), signal.quantity(), signal.limitPrice());

        oms.submitOrder(signal.toOrder());
    }

    public List<Strategy> getStrategies() {
        return List.copyOf(strategies);
    }

    public int getActiveCount() {
        return (int) strategies.stream().filter(Strategy::isActive).count();
    }
}
