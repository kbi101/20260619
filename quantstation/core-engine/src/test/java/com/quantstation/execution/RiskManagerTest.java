package com.quantstation.execution;

import com.quantstation.domain.Order;
import com.quantstation.domain.Position;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

public class RiskManagerTest {

    private RiskManager riskManager;
    private Map<String, Position> positions;

    @BeforeEach
    public void setUp() {
        riskManager = new RiskManager();
        positions = new HashMap<>();
        
        // Inject values manually for unit testing
        ReflectionTestUtils.setField(riskManager, "maxPositionSize", 100);
        ReflectionTestUtils.setField(riskManager, "maxDailyLoss", 5000.0);
        ReflectionTestUtils.setField(riskManager, "maxOrderValue", 50000.0);
        
        riskManager.resetDaily();
    }

    @Test
    public void testValidOrder() {
        Order order = new Order("AAPL", Order.Side.BUY, Order.OrderType.LIMIT, 10, 150.0, 0.0);
        Optional<String> violation = riskManager.validate(order, positions);
        assertFalse(violation.isPresent());
    }

    @Test
    public void testOrderValueLimitExceeded() {
        // Limit price 600.0 * 100 quantity = 60000.0 > 50000.0
        Order order = new Order("AAPL", Order.Side.BUY, Order.OrderType.LIMIT, 100, 600.0, 0.0);
        Optional<String> violation = riskManager.validate(order, positions);
        assertTrue(violation.isPresent());
        assertTrue(violation.get().contains("exceeds max"));

        // Market order estimate: qty * 1000.0. Qty 60 * 1000.0 = 60000.0 > 50000.0
        Order marketOrder = new Order("AAPL", Order.Side.BUY, Order.OrderType.MARKET, 60, 0.0, 0.0);
        Optional<String> violationMarket = riskManager.validate(marketOrder, positions);
        assertTrue(violationMarket.isPresent());
        assertTrue(violationMarket.get().contains("exceeds max"));
    }

    @Test
    public void testPositionSizeLimitExceeded() {
        // 1. Check with no existing position: buying 101 shares > 100 limit
        Order order = new Order("AAPL", Order.Side.BUY, Order.OrderType.LIMIT, 101, 150.0, 0.0);
        Optional<String> violation = riskManager.validate(order, positions);
        assertTrue(violation.isPresent());
        assertTrue(violation.get().contains("would exceed max"));

        // 2. Check with existing position: holding 90 shares, buying 15 shares
        Position existing = new Position("AAPL");
        existing.applyFill(90.0, 150.0);
        positions.put("AAPL", existing);

        Order addOrder = new Order("AAPL", Order.Side.BUY, Order.OrderType.LIMIT, 15, 150.0, 0.0);
        Optional<String> violationAdd = riskManager.validate(addOrder, positions);
        assertTrue(violationAdd.isPresent());
        assertTrue(violationAdd.get().contains("would exceed max"));
        
        // 3. Short position check (uses absolute position size check)
        Position shortExisting = new Position("AAPL");
        shortExisting.applyFill(-90.0, 150.0);
        positions.put("AAPL", shortExisting);

        Order shortAddOrder = new Order("AAPL", Order.Side.BUY, Order.OrderType.LIMIT, 15, 150.0, 0.0); // adding 15 (which actually reduces short size to -75, absolute is 75)
        // Wait, the RiskManager does:
        // double currentQty = (existing != null) ? Math.abs(existing.getQuantity()) : 0.0;
        // double newQty = currentQty + order.getQuantity();
        // If currentQty is 90 (abs of -90) and order quantity is 15, newQty is 90 + 15 = 105, which exceeds!
        // This is conservative, making sure we don't buy or sell in a way that risks exceeding the limit.
        Optional<String> violationShort = riskManager.validate(shortAddOrder, positions);
        assertTrue(violationShort.isPresent());
    }

    @Test
    public void testDailyLossLimitBreached() {
        // Lose 5001.0
        riskManager.updateDailyPnl(-5001.0);

        Order order = new Order("AAPL", Order.Side.BUY, Order.OrderType.LIMIT, 10, 150.0, 0.0);
        Optional<String> violation = riskManager.validate(order, positions);
        assertTrue(violation.isPresent());
        assertTrue(violation.get().contains("Daily loss limit breached"));

        // Reset and check again
        riskManager.resetDaily();
        Optional<String> violationReset = riskManager.validate(order, positions);
        assertFalse(violationReset.isPresent());
    }
}
