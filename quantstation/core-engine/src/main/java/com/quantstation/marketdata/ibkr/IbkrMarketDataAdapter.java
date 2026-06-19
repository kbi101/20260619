package com.quantstation.marketdata.ibkr;

import com.quantstation.marketdata.MarketDataProvider;
import com.quantstation.domain.Tick;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Set;

/**
 * IBKR Market Data adapter — Current active provider.
 *
 * <p>Subscribes to market data via the IB Gateway TWS API and forwards
 * ticks to the TickRouter. This adapter is active when using IBKR for
 * both execution and market data (before Massive.com transition).
 *
 * <p>Active on profiles: {@code default}, {@code paper}, {@code live}
 */
@Component
@Profile({"default", "paper", "live"})
public class IbkrMarketDataAdapter implements MarketDataProvider {

    private static final Logger log = LoggerFactory.getLogger(IbkrMarketDataAdapter.class);

    private TickListener tickListener;
    private final Set<String> subscribedSymbols = new HashSet<>();
    private boolean connected = false;

    @Override
    public void subscribe(String symbol) {
        if (subscribedSymbols.add(symbol)) {
            log.info("IBKR MarketData: Subscribing to {}", symbol);
            // TODO: Implement with TWS API:
            // Contract contract = new Contract();
            // contract.symbol(symbol);
            // contract.secType("STK");
            // contract.exchange("SMART");
            // contract.currency("USD");
            // client.reqMktData(nextReqId(), contract, "", false, false, null);
        }
    }

    @Override
    public void unsubscribe(String symbol) {
        if (subscribedSymbols.remove(symbol)) {
            log.info("IBKR MarketData: Unsubscribing from {}", symbol);
            // TODO: client.cancelMktData(reqId);
        }
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
        return "IBKR";
    }

    /**
     * Called internally when a tick is received from IB Gateway callbacks.
     * Forwards to the registered TickListener (TickRouter).
     */
    public void forwardTick(Tick tick) {
        if (tickListener != null) {
            tickListener.onTick(tick);
        }
    }

    public Set<String> getSubscribedSymbols() {
        return Set.copyOf(subscribedSymbols);
    }
}
