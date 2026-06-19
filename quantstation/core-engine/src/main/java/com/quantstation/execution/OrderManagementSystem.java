package com.quantstation.execution;

import com.quantstation.domain.Order;
import com.quantstation.domain.Position;
import com.quantstation.execution.ibkr.IbkrOrderRouter;
import com.quantstation.repository.RedisStateRepository;
import com.quantstation.web.UiWebSocketController;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Order Management System — The heart of the Execution Plane.
 *
 * <p>Manages the full lifecycle of orders:
 * <ol>
 *   <li>Receives order requests from the UI or Strategy engine</li>
 *   <li>Validates through the RiskManager</li>
 *   <li>Routes to IB Gateway via IbkrOrderRouter</li>
 *   <li>Tracks state transitions and notifies subscribers</li>
 * </ol>
 *
 * <p>All active orders are stored in-memory (ConcurrentHashMap) and mirrored to Redis.
 */
@Service
public class OrderManagementSystem {

    private static final Logger log = LoggerFactory.getLogger(OrderManagementSystem.class);

    private final RiskManager riskManager;
    private final IbkrOrderRouter orderRouter;
    private final RedisStateRepository redisState;
    private final UiWebSocketController uiPush;

    // In-memory order book — ConcurrentHashMap for thread safety
    private final Map<String, Order> activeOrders = new ConcurrentHashMap<>();
    private final Map<String, Position> positions = new ConcurrentHashMap<>();

    public OrderManagementSystem(RiskManager riskManager,
                                 IbkrOrderRouter orderRouter,
                                 RedisStateRepository redisState,
                                 UiWebSocketController uiPush) {
        this.riskManager = riskManager;
        this.orderRouter = orderRouter;
        this.redisState = redisState;
        this.uiPush = uiPush;
    }

    /**
     * Submit a new order through the execution pipeline.
     *
     * @param order The order to submit
     * @return The order with updated status
     */
    public Order submitOrder(Order order) {
        log.info("OMS: Submitting order {}", order);

        // 1. Pre-trade risk validation
        Optional<String> riskViolation = riskManager.validate(order, positions);
        if (riskViolation.isPresent()) {
            order.markRejected(riskViolation.get());
            log.warn("OMS: Order rejected by RiskManager: {}", riskViolation.get());
            uiPush.pushOrderUpdate(order);
            return order;
        }

        // 2. Track in active orders
        activeOrders.put(order.getOrderId(), order);

        // 3. Route to IB Gateway
        try {
            orderRouter.routeOrder(order);
            log.info("OMS: Order routed to IB Gateway: {}", order.getOrderId());
        } catch (Exception e) {
            order.markRejected("Routing failed: " + e.getMessage());
            activeOrders.remove(order.getOrderId());
            log.error("OMS: Failed to route order {}", order.getOrderId(), e);
        }

        // 4. Mirror to Redis and push to UI
        redisState.saveOrder(order);
        uiPush.pushOrderUpdate(order);
        return order;
    }

    /**
     * Cancel an active order.
     */
    public void cancelOrder(String orderId) {
        Order order = activeOrders.get(orderId);
        if (order == null) {
            log.warn("OMS: Cancel requested for unknown order: {}", orderId);
            return;
        }
        if (order.isTerminal()) {
            log.warn("OMS: Cannot cancel terminal order: {}", orderId);
            return;
        }

        orderRouter.cancelOrder(order);
        log.info("OMS: Cancel request sent for order {}", orderId);
    }

    /**
     * Called by the IBKR callback handler when a fill is received.
     */
    public void onFill(String orderId, double fillQty, double fillPrice) {
        Order order = activeOrders.get(orderId);
        if (order == null) {
            log.warn("OMS: Fill received for unknown order: {}", orderId);
            return;
        }

        order.applyFill(fillQty, fillPrice);
        log.info("OMS: Fill applied — {} filled {}/{} @ {}",
                orderId, order.getFilledQuantity(), order.getQuantity(), fillPrice);

        // Update position
        Position position = positions.computeIfAbsent(order.getSymbol(), Position::new);
        double signedQty = (order.getSide() == Order.Side.BUY) ? fillQty : -fillQty;
        position.applyFill(signedQty, fillPrice);

        // Clean up terminal orders
        if (order.isTerminal()) {
            activeOrders.remove(orderId);
        }

        // Persist and push
        redisState.saveOrder(order);
        redisState.savePosition(position);
        uiPush.pushOrderUpdate(order);
        uiPush.pushPositionUpdate(position);
    }

    /**
     * Called by the IBKR callback handler when an order status changes.
     */
    public void onOrderStatus(String orderId, String status, String message) {
        Order order = activeOrders.get(orderId);
        if (order == null) return;

        switch (status.toUpperCase()) {
            case "SUBMITTED" -> { /* already tracked */ }
            case "CANCELLED" -> {
                order.markCancelled();
                activeOrders.remove(orderId);
            }
            case "REJECTED", "INACTIVE" -> {
                order.markRejected(message);
                activeOrders.remove(orderId);
            }
        }

        redisState.saveOrder(order);
        uiPush.pushOrderUpdate(order);
    }

    // ── Accessors ─────────────────────────────────────

    public Map<String, Order> getActiveOrders() {
        return Map.copyOf(activeOrders);
    }

    public Map<String, Position> getPositions() {
        return Map.copyOf(positions);
    }

    public Optional<Order> getOrder(String orderId) {
        return Optional.ofNullable(activeOrders.get(orderId));
    }

    public Optional<Position> getPosition(String symbol) {
        return Optional.ofNullable(positions.get(symbol));
    }
}
