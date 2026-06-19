package com.quantstation.execution;

import com.quantstation.domain.Order;
import com.quantstation.domain.Position;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

/**
 * Pre-trade risk validation engine.
 *
 * <p>Every order passes through the RiskManager before being routed to IB Gateway.
 * Validates against configurable limits:
 * <ul>
 *   <li>Maximum position size per symbol</li>
 *   <li>Maximum daily loss threshold</li>
 *   <li>Maximum single order value</li>
 * </ul>
 */
@Service
public class RiskManager {

    private static final Logger log = LoggerFactory.getLogger(RiskManager.class);

    @Value("${quantstation.risk.max-position-size:100}")
    private int maxPositionSize;

    @Value("${quantstation.risk.max-daily-loss:5000.0}")
    private double maxDailyLoss;

    @Value("${quantstation.risk.max-order-value:50000.0}")
    private double maxOrderValue;

    private double dailyRealizedPnl = 0.0;

    /**
     * Validates an order against risk parameters.
     *
     * @param order     The order to validate
     * @param positions Current position map
     * @return Empty if valid, or a rejection reason
     */
    public Optional<String> validate(Order order, Map<String, Position> positions) {
        // 1. Order value check
        double orderValue = order.getQuantity() * order.getLimitPrice();
        if (order.getOrderType() == Order.OrderType.MARKET) {
            // For market orders, use a reasonable estimate (will be refined)
            orderValue = order.getQuantity() * 1000.0; // Conservative placeholder
        }

        if (orderValue > maxOrderValue) {
            return Optional.of(String.format(
                    "Order value %.2f exceeds max %.2f", orderValue, maxOrderValue));
        }

        // 2. Position size check
        Position existing = positions.get(order.getSymbol());
        double currentQty = (existing != null) ? Math.abs(existing.getQuantity()) : 0.0;
        double newQty = currentQty + order.getQuantity();

        if (newQty > maxPositionSize) {
            return Optional.of(String.format(
                    "Position size %.0f would exceed max %d for %s",
                    newQty, maxPositionSize, order.getSymbol()));
        }

        // 3. Daily loss limit check
        if (dailyRealizedPnl < -maxDailyLoss) {
            return Optional.of(String.format(
                    "Daily loss limit breached: realized PnL %.2f exceeds -%.2f",
                    dailyRealizedPnl, maxDailyLoss));
        }

        log.debug("RiskManager: Order {} passed all checks", order.getOrderId());
        return Optional.empty();
    }

    /**
     * Update daily PnL tracking (called on each fill).
     */
    public void updateDailyPnl(double realizedPnl) {
        this.dailyRealizedPnl += realizedPnl;
        log.info("RiskManager: Daily realized PnL updated to {}", this.dailyRealizedPnl);
    }

    /**
     * Reset daily counters (call at market open or start of day).
     */
    public void resetDaily() {
        this.dailyRealizedPnl = 0.0;
        log.info("RiskManager: Daily counters reset");
    }
}
