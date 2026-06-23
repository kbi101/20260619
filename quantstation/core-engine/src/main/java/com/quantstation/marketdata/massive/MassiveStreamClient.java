package com.quantstation.marketdata.massive;

import com.quantstation.marketdata.MarketDataProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Set;

/**
 * Massive.com (ex-Polygon.io) WebSocket streaming client.
 *
 * <p><strong>STATUS: SKELETON</strong> — This is a contract stub implementing the
 * {@link MarketDataProvider} interface. It defines the integration contract for
 * the future data pipe transition.
 *
 * <p>When activated:
 * <ol>
 *   <li>Set {@code spring.profiles.active=massive}</li>
 *   <li>Set {@code MASSIVE_API_KEY} environment variable</li>
 *   <li>The IB Gateway is strictly relegated to the Execution Plane only</li>
 * </ol>
 *
 * <p>Connection: {@code wss://socket.massive.com/options}
 *
 * <p>Official JVM SDK: {@code massive-com/client-jvm} (Kotlin, Java-compatible)
 *
 * @see <a href="https://api.massive.com">Massive.com API Documentation</a>
 */
@Component
@Profile("massive")
public class MassiveStreamClient implements MarketDataProvider {

    private static final Logger log = LoggerFactory.getLogger(MassiveStreamClient.class);

    @Value("${quantstation.massive.ws-url:wss://socket.massive.com/options}")
    private String wsUrl;

    @Value("${quantstation.massive.api-key:}")
    private String apiKey;

    private TickListener tickListener;
    private final Set<String> subscribedSymbols = new HashSet<>();
    private boolean connected = false;

    @Override
    public void subscribe(String symbol) {
        subscribedSymbols.add(symbol);
        log.info("Massive.com: Subscribe queued for {} (awaiting implementation)", symbol);

        // TODO: Implement with Massive JVM SDK:
        // streamClient.subscribeToOptions(symbol, (message) -> {
        //     Tick tick = parseMassiveMessage(message);
        //     if (tickListener != null) tickListener.onTick(tick);
        // });
    }

    @Override
    public void unsubscribe(String symbol) {
        subscribedSymbols.remove(symbol);
        log.info("Massive.com: Unsubscribe queued for {}", symbol);
    }

    @Override
    public void setTickListener(TickListener listener) {
        this.tickListener = listener;
    }

    @Override
    public boolean isConnected() {
        return connected;
    }

    @Override
    public String getProviderName() {
        return "Massive.com";
    }

    @Override
    public java.util.concurrent.CompletableFuture<java.util.List<com.quantstation.domain.BarData>> fetchHistoricalBars(
            String symbol, String duration, String barSize) {
        log.warn("Massive.com: Historical bars not implemented. Returning empty list.");
        return java.util.concurrent.CompletableFuture.completedFuture(java.util.List.of());
    }

    // TODO: Implement WebSocket connection lifecycle:
    // private void connect() {
    //     // 1. Open WebSocket to wsUrl
    //     // 2. Send auth message: {"action":"auth","params":"<apiKey>"}
    //     // 3. On auth success, re-subscribe to all symbols
    //     // 4. Parse incoming messages and forward to tickListener
    // }
}
