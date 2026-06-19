package com.quantstation.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Represents an order in the Order Management System.
 *
 * <p>Tracks the full lifecycle of an order from creation through execution.
 * The state machine transitions:
 * {@code PENDING → SUBMITTED → PARTIAL_FILL → FILLED | CANCELLED | REJECTED}
 */
public class Order {

    public enum Side { BUY, SELL }

    public enum OrderType { MARKET, LIMIT, STOP, STOP_LIMIT }

    public enum Status {
        PENDING,        // Created, not yet submitted
        SUBMITTED,      // Sent to IB Gateway
        PARTIAL_FILL,   // Partially filled
        FILLED,         // Fully filled
        CANCELLED,      // Cancelled by user or system
        REJECTED        // Rejected by broker or risk manager
    }

    private final String orderId;
    private final String symbol;
    private final Side side;
    private final OrderType orderType;
    private final double quantity;
    private double limitPrice;
    private double stopPrice;

    private Status status;
    private double filledQuantity;
    private double avgFillPrice;
    private String rejectReason;

    private int ibkrOrderId;    // IB Gateway's internal order ID
    private final Instant createdAt;
    private Instant updatedAt;

    public Order(String symbol, Side side, OrderType orderType,
                 double quantity, double limitPrice, double stopPrice) {
        this.orderId = UUID.randomUUID().toString();
        this.symbol = symbol;
        this.side = side;
        this.orderType = orderType;
        this.quantity = quantity;
        this.limitPrice = limitPrice;
        this.stopPrice = stopPrice;
        this.status = Status.PENDING;
        this.filledQuantity = 0.0;
        this.avgFillPrice = 0.0;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    // ── State Transitions ─────────────────────────────

    public void markSubmitted(int ibkrOrderId) {
        this.ibkrOrderId = ibkrOrderId;
        this.status = Status.SUBMITTED;
        this.updatedAt = Instant.now();
    }

    public void applyFill(double fillQty, double fillPrice) {
        double totalCost = (this.avgFillPrice * this.filledQuantity) + (fillPrice * fillQty);
        this.filledQuantity += fillQty;
        this.avgFillPrice = totalCost / this.filledQuantity;
        this.status = (this.filledQuantity >= this.quantity)
                ? Status.FILLED
                : Status.PARTIAL_FILL;
        this.updatedAt = Instant.now();
    }

    public void markCancelled() {
        this.status = Status.CANCELLED;
        this.updatedAt = Instant.now();
    }

    public void markRejected(String reason) {
        this.status = Status.REJECTED;
        this.rejectReason = reason;
        this.updatedAt = Instant.now();
    }

    public boolean isTerminal() {
        return status == Status.FILLED
                || status == Status.CANCELLED
                || status == Status.REJECTED;
    }

    public double remainingQuantity() {
        return quantity - filledQuantity;
    }

    // ── Getters ──────────────────────────────────────

    public String getOrderId() { return orderId; }
    public String getSymbol() { return symbol; }
    public Side getSide() { return side; }
    public OrderType getOrderType() { return orderType; }
    public double getQuantity() { return quantity; }
    public double getLimitPrice() { return limitPrice; }
    public double getStopPrice() { return stopPrice; }
    public Status getStatus() { return status; }
    public double getFilledQuantity() { return filledQuantity; }
    public double getAvgFillPrice() { return avgFillPrice; }
    public String getRejectReason() { return rejectReason; }
    public int getIbkrOrderId() { return ibkrOrderId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    @Override
    public String toString() {
        return String.format("Order{%s %s %s %.0f %s @ %.2f, filled=%.0f/%.0f, status=%s}",
                orderId.substring(0, 8), side, symbol, quantity, orderType,
                limitPrice, filledQuantity, quantity, status);
    }
}
