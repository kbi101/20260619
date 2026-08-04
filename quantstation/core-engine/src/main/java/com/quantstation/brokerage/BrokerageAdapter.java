package com.quantstation.brokerage;

import com.quantstation.domain.AccountSummary;
import java.util.List;
import java.util.Optional;

/**
 * Interface defining operations that any brokerage integration adapter must implement.
 */
public interface BrokerageAdapter {

    /**
     * Get the provider type.
     */
    BrokerageProvider getProvider();

    /**
     * Get the list of account IDs managed by this brokerage adapter.
     */
    List<String> getAccountIds();

    /**
     * Get real-time account summary snapshot for a given account ID.
     */
    Optional<AccountSummary> getAccountSummary(String accountId);

    /**
     * Check if the brokerage connection is active.
     */
    boolean isConnected();

    /**
     * Subscribe to real-time account streaming updates for an account ID.
     */
    void subscribeAccountUpdates(String accountId);

    /**
     * Unsubscribe from account updates.
     */
    void unsubscribeAccountUpdates(String accountId);
}
