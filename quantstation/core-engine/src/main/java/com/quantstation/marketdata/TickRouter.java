package com.quantstation.marketdata;

import com.quantstation.domain.Tick;
import com.quantstation.repository.QuestDbTickWriter;
import com.quantstation.repository.RedisStateRepository;
import com.quantstation.strategy.StrategyEngine;
import com.quantstation.web.UiWebSocketController;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;

/**
 * Central tick distribution hub — the Data Plane's core.
 *
 * <p>Fan-out architecture:
 * <pre>
 * Incoming Tick
 *     ├──→ Redis (update live state: last price, spreads)
 *     ├──→ QuestDB (batch flush for time-series persistence)
 *     ├──→ StrategyEngine (signal generation)
 *     └──→ UI WebSocket (throttled push every 50ms)
 * </pre>
 *
 * <p>The UI push is throttled to prevent overwhelming the Electron renderer.
 * Ticks are buffered and the latest state is pushed at a fixed cadence.
 */
@Service
public class TickRouter implements MarketDataProvider.TickListener {

    private static final Logger log = LoggerFactory.getLogger(TickRouter.class);

    private final RedisStateRepository redisState;
    private final QuestDbTickWriter questDbWriter;
    private final StrategyEngine strategyEngine;
    private final UiWebSocketController uiPush;

    @Value("${quantstation.tick-router.ui-push-interval-ms:50}")
    private int uiPushIntervalMs;

    // Buffer for throttled UI push — latest tick per symbol
    private final Map<String, Tick> latestTicks = new ConcurrentHashMap<>();

    private ScheduledExecutorService uiPushScheduler;

    public TickRouter(RedisStateRepository redisState,
                      QuestDbTickWriter questDbWriter,
                      StrategyEngine strategyEngine,
                      UiWebSocketController uiPush) {
        this.redisState = redisState;
        this.questDbWriter = questDbWriter;
        this.strategyEngine = strategyEngine;
        this.uiPush = uiPush;
    }

    /**
     * Initialize the throttled UI push scheduler.
     */
    @jakarta.annotation.PostConstruct
    public void init() {
        uiPushScheduler = Executors.newSingleThreadScheduledExecutor(
                Thread.ofVirtual().name("tick-ui-push-", 0).factory()
        );

        uiPushScheduler.scheduleAtFixedRate(
                this::flushToUi,
                uiPushIntervalMs,
                uiPushIntervalMs,
                TimeUnit.MILLISECONDS
        );

        log.info("TickRouter: UI push scheduler started ({}ms interval)", uiPushIntervalMs);
    }

    @jakarta.annotation.PreDestroy
    public void shutdown() {
        if (uiPushScheduler != null) {
            uiPushScheduler.shutdown();
        }
    }

    /**
     * Main entry point — called by the active MarketDataProvider on each tick.
     *
     * <p>This is the hot path. Keep allocations minimal.
     */
    @Override
    public void onTick(Tick tick) {
        // 1. Redis — update live state (instant)
        redisState.updateLastPrice(tick.symbol(), tick.price());

        // 2. QuestDB — batch buffer (flushed periodically)
        questDbWriter.bufferTick(tick);

        // 3. Strategy Engine — signal generation
        strategyEngine.onTick(tick);

        // 4. UI — buffer for throttled push
        latestTicks.put(tick.symbol(), tick);
    }

    /**
     * Flush buffered ticks to the UI WebSocket.
     * Called at fixed intervals by the scheduler.
     */
    private void flushToUi() {
        if (latestTicks.isEmpty()) return;

        // Swap and send — minimize lock time
        Map<String, Tick> snapshot = Map.copyOf(latestTicks);
        latestTicks.clear();

        log.info("TickRouter: Pushing {} ticks to UI", snapshot.size());
        for (Tick tick : snapshot.values()) {
            try {
                uiPush.pushTick(tick);
                log.info("TickRouter: Pushed tick for {} to UI: price={}, size={}", tick.symbol(), tick.price(), tick.size());
            } catch (Exception e) {
                log.error("TickRouter: Failed to push tick to UI for symbol {}", tick.symbol(), e);
            }
        }
    }

    /**
     * Get the latest tick for a symbol (for REST queries).
     */
    public Tick getLatestTick(String symbol) {
        return latestTicks.get(symbol);
    }
}
