package com.quantstation.marketdata.ibkr;

import com.ib.client.Contract;
import com.quantstation.domain.BarData;
import com.quantstation.domain.Tick;
import com.quantstation.execution.ibkr.IbkrCallbackHandler;
import com.quantstation.execution.ibkr.IbkrConnectionManager;
import com.quantstation.marketdata.MarketDataProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import jakarta.annotation.PostConstruct;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * IBKR Market Data adapter — Current active provider.
 */
@Component
@Profile({"default", "paper", "live"})
public class IbkrMarketDataAdapter implements MarketDataProvider {

    private static final Logger log = LoggerFactory.getLogger(IbkrMarketDataAdapter.class);

    private final IbkrConnectionManager connectionManager;
    private final IbkrCallbackHandler callbackHandler;

    private TickListener tickListener;
    private final Set<String> desiredSymbols = ConcurrentHashMap.newKeySet();
    private final Set<String> subscribedSymbols = ConcurrentHashMap.newKeySet();
    private final Map<Integer, String> reqIdToSymbol = new ConcurrentHashMap<>();
    private final Map<String, Integer> symbolToReqId = new ConcurrentHashMap<>();
    private final AtomicInteger nextReqId = new AtomicInteger(1000);

    private final Set<String> desiredChartSymbols = ConcurrentHashMap.newKeySet();
    private final Set<String> subscribedChartSymbols = ConcurrentHashMap.newKeySet();
    private final Map<String, Integer> symbolToChartReqId = new ConcurrentHashMap<>();
    private final List<String> chartEvictionQueue = new java.util.concurrent.CopyOnWriteArrayList<>();

    public IbkrMarketDataAdapter(IbkrConnectionManager connectionManager,
                                 IbkrCallbackHandler callbackHandler) {
        this.connectionManager = connectionManager;
        this.callbackHandler = callbackHandler;
    }

    @PostConstruct
    public void init() {
        Thread.startVirtualThread(() -> {
            boolean wasConnected = false;
            while (true) {
                try {
                    Thread.sleep(1000);
                    boolean isConnected = connectionManager.isConnected();
                    if (isConnected && !wasConnected) {
                        log.info("IBKR MarketData: Connection established/recovered, re-subscribing to {} active symbols and {} chart symbols", 
                                desiredSymbols.size(), desiredChartSymbols.size());
                        for (String symbol : desiredSymbols) {
                            doSubscribe(symbol);
                        }
                        for (String symbol : desiredChartSymbols) {
                            doSubscribeChart(symbol);
                        }
                    } else if (!isConnected && wasConnected) {
                        log.warn("IBKR MarketData: Connection lost, resetting active subscriptions");
                        subscribedSymbols.clear();
                        reqIdToSymbol.clear();
                        symbolToReqId.clear();

                        subscribedChartSymbols.clear();
                        symbolToChartReqId.clear();
                    }
                    wasConnected = isConnected;
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    log.error("IBKR MarketData: Error in connection monitor thread", e);
                }
            }
        });
    }

    @Override
    public void subscribe(String symbol) {
        if (desiredSymbols.add(symbol)) {
            log.info("IBKR MarketData: Client requested subscription for {}", symbol);
            if (connectionManager.isConnected()) {
                doSubscribe(symbol);
            } else {
                log.warn("IBKR MarketData: Cannot subscribe to {} immediately — not connected to IB Gateway (queued)", symbol);
            }
        }
    }

    private void doSubscribe(String symbol) {
        if (subscribedSymbols.add(symbol)) {
            log.info("IBKR MarketData: Sending reqMktData for {}", symbol);
            int reqId = nextReqId.getAndIncrement();
            reqIdToSymbol.put(reqId, symbol);
            symbolToReqId.put(symbol, reqId);

            Contract contract = new Contract();
            contract.symbol(symbol);
            contract.secType("STK");
            contract.exchange("SMART");
            contract.currency("USD");

            try {
                connectionManager.getClient().reqMktData(reqId, contract, "", false, false, null);
            } catch (Exception e) {
                log.error("IBKR MarketData: Failed to send reqMktData for {}", symbol, e);
                subscribedSymbols.remove(symbol);
                reqIdToSymbol.remove(reqId);
                symbolToReqId.remove(symbol);
            }
        }
    }

    @Override
    public void unsubscribe(String symbol) {
        if (desiredSymbols.remove(symbol)) {
            log.info("IBKR MarketData: Client requested unsubscribe for {}", symbol);
            doUnsubscribe(symbol);
        }
    }

    private void doUnsubscribe(String symbol) {
        if (subscribedSymbols.remove(symbol)) {
            log.info("IBKR MarketData: Canceling reqMktData for {}", symbol);
            Integer reqId = symbolToReqId.remove(symbol);
            if (reqId != null) {
                reqIdToSymbol.remove(reqId);
                if (connectionManager.isConnected()) {
                    try {
                        connectionManager.getClient().cancelMktData(reqId);
                    } catch (Exception e) {
                        log.error("IBKR MarketData: Failed to cancel market data for {}", symbol, e);
                    }
                }
            }
        }
    }

    @Override
    public void subscribeChart(String symbol) {
        log.info("IBKR MarketData: Client requested chart subscription for {}", symbol);
        synchronized (chartEvictionQueue) {
            if (desiredChartSymbols.contains(symbol)) {
                // Already in desired, move it to the end of the eviction queue so it's considered "most recent"
                chartEvictionQueue.remove(symbol);
                chartEvictionQueue.add(symbol);
                return;
            }

            while (desiredChartSymbols.size() >= 3) {
                String oldest = chartEvictionQueue.isEmpty() ? null : chartEvictionQueue.remove(0);
                if (oldest != null) {
                    log.info("IBKR MarketData: Evicting oldest chart subscription {} to respect limit of 3", oldest);
                    desiredChartSymbols.remove(oldest);
                    doUnsubscribeChart(oldest);
                } else {
                    break;
                }
            }

            desiredChartSymbols.add(symbol);
            chartEvictionQueue.add(symbol);
        }

        if (connectionManager.isConnected()) {
            doSubscribeChart(symbol);
        } else {
            log.warn("IBKR MarketData: Cannot subscribe chart to {} immediately — not connected to IB Gateway (queued)", symbol);
        }
    }

    private void doSubscribeChart(String symbol) {
        if (subscribedChartSymbols.add(symbol)) {
            log.info("IBKR MarketData: Sending reqTickByTickData for {}", symbol);
            int reqId = nextReqId.getAndIncrement();
            reqIdToSymbol.put(reqId, symbol);
            symbolToChartReqId.put(symbol, reqId);

            Contract contract = new Contract();
            contract.symbol(symbol);
            contract.secType("STK");
            contract.exchange("SMART");
            contract.currency("USD");

            try {
                connectionManager.getClient().reqTickByTickData(reqId, contract, "Last", 0, false);
            } catch (Exception e) {
                log.error("IBKR MarketData: Failed to send reqTickByTickData for {}", symbol, e);
                subscribedChartSymbols.remove(symbol);
                reqIdToSymbol.remove(reqId);
                symbolToChartReqId.remove(symbol);
            }
        }
    }

    @Override
    public void unsubscribeChart(String symbol) {
        log.info("IBKR MarketData: Client requested chart unsubscribe for {}", symbol);
        synchronized (chartEvictionQueue) {
            desiredChartSymbols.remove(symbol);
            chartEvictionQueue.remove(symbol);
        }
        doUnsubscribeChart(symbol);
        if (!desiredSymbols.contains(symbol)) {
            doUnsubscribe(symbol);
        }
    }

    private void doUnsubscribeChart(String symbol) {
        if (subscribedChartSymbols.remove(symbol)) {
            log.info("IBKR MarketData: Canceling reqTickByTickData for {}", symbol);
            Integer reqId = symbolToChartReqId.remove(symbol);
            if (reqId != null) {
                reqIdToSymbol.remove(reqId);
                if (connectionManager.isConnected()) {
                    try {
                        connectionManager.getClient().cancelTickByTickData(reqId);
                    } catch (Exception e) {
                        log.error("IBKR MarketData: Failed to cancel tick-by-tick data for {}", symbol, e);
                    }
                }
            }
        }
    }

    public void handleChartSubscriptionFallback(int reqId) {
        String symbol = reqIdToSymbol.get(reqId);
        if (symbol == null) return;

        log.warn("IBKR MarketData: High-precision feed failed for {} (reqId={}). Falling back to standard market data.", symbol, reqId);

        // Remove the failed chart request mappings
        symbolToChartReqId.remove(symbol);
        reqIdToSymbol.remove(reqId);
        subscribedChartSymbols.remove(symbol);

        // Fall back to standard subscription for this symbol
        doSubscribe(symbol);
    }

    @Override
    public Tick getLastTick(String symbol) {
        return callbackHandler.getLastTick(symbol);
    }

    @Override
    public Map<String, Tick> getLastTicks() {
        return callbackHandler.getLastTicks();
    }

    @Override
    public CompletableFuture<List<BarData>> fetchHistoricalBars(String symbol, String duration, String barSize) {
        String queryDuration = duration;
        // When RTH is disabled (useRTH = 0), a duration of "1 D" only returns data since midnight of the current day.
        // We dynamically switch to "2 D" to capture yesterday's full regular session as well.
        if ("1 D".equalsIgnoreCase(duration)) {
            queryDuration = "2 D";
        }

        log.info("IBKR MarketData: Fetching historical bars for {} (duration={}, queryDuration={}, size={})", 
                symbol, duration, queryDuration, barSize);
        
        CompletableFuture<List<BarData>> future = new CompletableFuture<>();
        
        if (!connectionManager.isConnected()) {
            log.warn("IBKR MarketData: Not connected — completing historical bars future exceptionally");
            future.completeExceptionally(new IllegalStateException("Not connected to IB Gateway"));
            return future;
        }

        int reqId = nextReqId.getAndIncrement();
        reqIdToSymbol.put(reqId, symbol);
        
        callbackHandler.registerHistoricalFuture(reqId, barSize, future);

        Contract contract = new Contract();
        contract.symbol(symbol);
        contract.secType("STK");
        contract.exchange("SMART");
        contract.currency("USD");

        try {
            connectionManager.getClient().reqHistoricalData(
                    reqId,
                    contract,
                    "", // endDateTime
                    queryDuration,
                    barSize,
                    "TRADES",
                    0, // useRTH (0 = include pre/post-market, 1 = RTH only)
                    2,
                    false,
                    null
            );
        } catch (Exception e) {
            log.error("IBKR MarketData: Failed to request historical data for {}", symbol, e);
            future.completeExceptionally(e);
        }

        return future;
    }

    @Override
    public void setTickListener(TickListener listener) {
        this.tickListener = listener;
    }

    @Override
    public boolean isConnected() {
        return connectionManager.isConnected();
    }

    @Override
    public String getProviderName() {
        return "IBKR";
    }

    public String getSymbolForReqId(int reqId) {
        return reqIdToSymbol.get(reqId);
    }

    public void forwardTick(Tick tick) {
        if (tickListener != null) {
            tickListener.onTick(tick);
        }
    }

    public Set<String> getSubscribedSymbols() {
        return Set.copyOf(subscribedSymbols);
    }
}
