package com.quantstation.brokerage.ibkr;

import com.ib.client.EClientSocket;
import com.quantstation.brokerage.BrokerageAdapter;
import com.quantstation.brokerage.BrokerageProvider;
import com.quantstation.domain.AccountSummary;
import com.quantstation.execution.ibkr.IbkrCallbackHandler;
import com.quantstation.execution.ibkr.IbkrConnectionManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * IBKR implementation of BrokerageAdapter using IB TWS API.
 */
@Component
public class IbkrBrokerageAdapter implements BrokerageAdapter {

    private static final Logger log = LoggerFactory.getLogger(IbkrBrokerageAdapter.class);

    private final IbkrConnectionManager connectionManager;
    private final IbkrCallbackHandler callbackHandler;

    private final Map<String, AccountSummary> accountCache = new ConcurrentHashMap<>();
    private final AtomicBoolean subscriptionsActive = new AtomicBoolean(false);

    public IbkrBrokerageAdapter(IbkrConnectionManager connectionManager, IbkrCallbackHandler callbackHandler) {
        this.connectionManager = connectionManager;
        this.callbackHandler = callbackHandler;
    }

    @Override
    public BrokerageProvider getProvider() {
        return BrokerageProvider.IBKR;
    }

    @Override
    public List<String> getAccountIds() {
        List<String> accounts = callbackHandler.getManagedAccounts();
        if (accounts.isEmpty()) {
            return List.of("DU123456"); // Fallback IBKR paper account ID
        }
        return accounts;
    }

    @Override
    public Optional<AccountSummary> getAccountSummary(String accountId) {
        AccountSummary cached = callbackHandler.getAccountSummary(accountId);
        if (cached != null) {
            return Optional.of(cached);
        }
        return Optional.ofNullable(accountCache.get(accountId));
    }

    @Override
    public boolean isConnected() {
        return connectionManager.isConnected();
    }

    @Override
    public void subscribeAccountUpdates(String accountId) {
        if (!connectionManager.isConnected()) {
            log.warn("IbkrBrokerageAdapter: Cannot subscribe to account updates — IB Gateway not connected");
            return;
        }

        EClientSocket client = connectionManager.getClient();
        if (client != null && client.isConnected()) {
            try {
                log.info("IbkrBrokerageAdapter: Subscribing to IBKR AccountSummary & PnL for account: {}", accountId);
                // reqAccountSummary reqId 9001
                client.reqAccountSummary(9001, "All", "NetLiquidation,TotalCashValue,BuyingPower,GrossPositionValue,FullMaintMarginReq,ExcessLiquidity,RealizedPnL,UnrealizedPnL");
                // reqPnL reqId 9002
                client.reqPnL(9002, accountId, "");
                subscriptionsActive.set(true);
            } catch (Exception e) {
                log.error("IbkrBrokerageAdapter: Error subscribing to IBKR account updates", e);
            }
        }
    }

    @Override
    public void unsubscribeAccountUpdates(String accountId) {
        EClientSocket client = connectionManager.getClient();
        if (client != null && client.isConnected() && subscriptionsActive.get()) {
            try {
                client.cancelAccountSummary(9001);
                client.cancelPnL(9002);
                subscriptionsActive.set(false);
            } catch (Exception e) {
                log.error("IbkrBrokerageAdapter: Error unsubscribing from IBKR account updates", e);
            }
        }
    }
}
