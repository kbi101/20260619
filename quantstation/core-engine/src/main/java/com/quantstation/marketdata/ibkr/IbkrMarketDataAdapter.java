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
                        log.info("IBKR MarketData: Connection established/recovered, re-subscribing to {} active symbols", desiredSymbols.size());
                        for (String symbol : desiredSymbols) {
                            doSubscribe(symbol);
                        }
                    } else if (!isConnected && wasConnected) {
                        log.warn("IBKR MarketData: Connection lost, resetting active subscriptions");
                        subscribedSymbols.clear();
                        reqIdToSymbol.clear();
                        symbolToReqId.clear();
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
    public Tick getLastTick(String symbol) {
        return callbackHandler.getLastTick(symbol);
    }

    @Override
    public Map<String, Tick> getLastTicks() {
        return callbackHandler.getLastTicks();
    }

    @Override
    public CompletableFuture<List<BarData>> fetchHistoricalBars(String symbol, String duration, String barSize) {
        log.info("IBKR MarketData: Fetching historical bars for {} (duration={}, size={})", 
                symbol, duration, barSize);
        
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
                    duration,
                    barSize,
                    "TRADES",
                    1,
                    1,
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
