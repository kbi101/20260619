package com.quantstation.domain;

import com.quantstation.brokerage.BrokerageProvider;
import java.time.Instant;

/**
 * Domain representation of a Brokerage Account Summary.
 * Immutable Java record suitable for REST JSON responses and WebSocket STOMP topics.
 */
public record AccountSummary(
        String accountId,
        BrokerageProvider provider,
        String accountName,
        String currency,
        double netLiquidation,
        double cash,
        double buyingPower,
        double marginUsed,
        double marginRemaining,
        double portfolioValue,
        double todayReturnPct,
        double realizedPnl,
        double unrealizedPnl,
        double totalPnl,
        double commissions,
        double grossExposure,
        double netExposure,
        boolean connected,
        Instant timestamp
) {}
