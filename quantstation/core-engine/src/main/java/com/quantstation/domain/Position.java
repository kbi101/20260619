package com.quantstation.domain;

import java.time.Instant;

/**
 * Represents an active position in a security.
 *
 * <p>Tracks quantity, cost basis, and real-time PnL.
 * Updated by the OMS on each fill and by market data ticks for unrealized PnL.
 */
public class Position {

    private final String symbol;
    private double quantity;           // Positive = long, negative = short
    private double avgCost;            // Average cost basis per unit
    private double marketPrice;        // Current market price
    private double unrealizedPnl;
    private double realizedPnl;
    private Instant lastUpdated;

    public Position(String symbol) {
        this.symbol = symbol;
        this.quantity = 0.0;
        this.avgCost = 0.0;
        this.marketPrice = 0.0;
        this.unrealizedPnl = 0.0;
        this.realizedPnl = 0.0;
        this.lastUpdated = Instant.now();
    }

    /**
     * Apply a fill to this position (updates quantity and cost basis).
     *
     * @param fillQty   Positive for buy, negative for sell
     * @param fillPrice The execution price
     */
    public void applyFill(double fillQty, double fillPrice) {
        if (quantity == 0.0 || Math.signum(quantity) == Math.signum(fillQty)) {
            // Opening or adding to position
            double totalCost = (avgCost * Math.abs(quantity)) + (fillPrice * Math.abs(fillQty));
            quantity += fillQty;
            avgCost = totalCost / Math.abs(quantity);
        } else {
            // Reducing or closing position
            double closingQty = Math.min(Math.abs(quantity), Math.abs(fillQty));
            realizedPnl += closingQty * (fillPrice - avgCost) * Math.signum(quantity);
            quantity += fillQty;

            // If position flipped, reset cost basis
            if (Math.abs(fillQty) > closingQty) {
                avgCost = fillPrice;
            }
        }
        this.lastUpdated = Instant.now();
        recalculateUnrealizedPnl();
    }

    /**
     * Update the market price and recalculate unrealized PnL.
     */
    public void updateMarketPrice(double newPrice) {
        this.marketPrice = newPrice;
        this.lastUpdated = Instant.now();
        recalculateUnrealizedPnl();
    }

    private void recalculateUnrealizedPnl() {
        if (quantity != 0.0 && marketPrice > 0.0) {
            unrealizedPnl = (marketPrice - avgCost) * quantity;
        } else {
            unrealizedPnl = 0.0;
        }
    }

    public double totalPnl() {
        return realizedPnl + unrealizedPnl;
    }

    public boolean isFlat() {
        return Math.abs(quantity) < 0.0001;
    }

    public boolean isLong() {
        return quantity > 0;
    }

    public boolean isShort() {
        return quantity < 0;
    }

    // ── Getters ──────────────────────────────────────

    public String getSymbol() { return symbol; }
    public double getQuantity() { return quantity; }
    public double getAvgCost() { return avgCost; }
    public double getMarketPrice() { return marketPrice; }
    public double getUnrealizedPnl() { return unrealizedPnl; }
    public double getRealizedPnl() { return realizedPnl; }
    public Instant getLastUpdated() { return lastUpdated; }

    @Override
    public String toString() {
        return String.format("Position{%s qty=%.2f avgCost=%.2f mkt=%.2f uPnl=%.2f rPnl=%.2f}",
                symbol, quantity, avgCost, marketPrice, unrealizedPnl, realizedPnl);
    }
}
