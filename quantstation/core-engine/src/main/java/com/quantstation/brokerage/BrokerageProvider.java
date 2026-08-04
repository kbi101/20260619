package com.quantstation.brokerage;

/**
 * Enum of supported brokerage providers.
 * Designed to allow adding future providers (Schwab, Alpaca, Tradier, Coinbase, etc.).
 */
public enum BrokerageProvider {
    IBKR("Interactive Brokers", "IBKR"),
    SCHWAB("Charles Schwab", "SCHWAB"),
    ALPACA("Alpaca Trading", "ALPACA"),
    MOCK("Mock / Paper Simulator", "SIM");

    private final String displayName;
    private final String code;

    BrokerageProvider(String displayName, String code) {
        this.displayName = displayName;
        this.code = code;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getCode() {
        return code;
    }
}
