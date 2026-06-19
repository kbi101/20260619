package com.quantstation.domain;

import org.junit.jupiter.api.Test;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;

public class OrderTest {

    @Test
    public void testInitialState() {
        Order order = new Order("AAPL", Order.Side.BUY, Order.OrderType.LIMIT, 100, 150.0, 0.0);
        assertNotNull(order.getOrderId());
        assertEquals("AAPL", order.getSymbol());
        assertEquals(Order.Side.BUY, order.getSide());
        assertEquals(Order.OrderType.LIMIT, order.getOrderType());
        assertEquals(100.0, order.getQuantity());
        assertEquals(150.0, order.getLimitPrice());
        assertEquals(0.0, order.getStopPrice());
        assertEquals(Order.Status.PENDING, order.getStatus());
        assertEquals(0.0, order.getFilledQuantity());
        assertEquals(0.0, order.getAvgFillPrice());
        assertNotNull(order.getCreatedAt());
        assertEquals(order.getCreatedAt(), order.getUpdatedAt());
        assertFalse(order.isTerminal());
        assertEquals(100.0, order.remainingQuantity());
    }

    @Test
    public void testMarkSubmitted() {
        Order order = new Order("AAPL", Order.Side.BUY, Order.OrderType.LIMIT, 100, 150.0, 0.0);
        Instant firstUpdate = order.getUpdatedAt();
        
        // Wait a tiny bit to ensure timestamp difference if any (though usually negligible)
        order.markSubmitted(42);
        
        assertEquals(Order.Status.SUBMITTED, order.getStatus());
        assertEquals(42, order.getIbkrOrderId());
        assertTrue(order.getUpdatedAt().isAfter(firstUpdate) || order.getUpdatedAt().equals(firstUpdate));
        assertFalse(order.isTerminal());
    }

    @Test
    public void testApplyFill() {
        Order order = new Order("AAPL", Order.Side.BUY, Order.OrderType.LIMIT, 100, 150.0, 0.0);
        order.markSubmitted(101);
        
        // Apply partial fill 1: 40 shares @ 149.0
        order.applyFill(40.0, 149.0);
        assertEquals(Order.Status.PARTIAL_FILL, order.getStatus());
        assertEquals(40.0, order.getFilledQuantity());
        assertEquals(60.0, order.remainingQuantity());
        assertEquals(149.0, order.getAvgFillPrice());
        assertFalse(order.isTerminal());

        // Apply partial fill 2: 30 shares @ 151.0
        // Expected avg price: ((40 * 149) + (30 * 151)) / 70 = (5960 + 4530) / 70 = 10490 / 70 = 149.85714...
        order.applyFill(30.0, 151.0);
        assertEquals(Order.Status.PARTIAL_FILL, order.getStatus());
        assertEquals(70.0, order.getFilledQuantity());
        assertEquals(30.0, order.remainingQuantity());
        assertEquals((40.0 * 149.0 + 30.0 * 151.0) / 70.0, order.getAvgFillPrice(), 0.00001);

        // Apply final fill: 30 shares @ 150.0
        // Expected avg price: ((70 * 149.85714...) + (30 * 150)) / 100 = (10490 + 4500) / 100 = 149.90
        order.applyFill(30.0, 150.0);
        assertEquals(Order.Status.FILLED, order.getStatus());
        assertEquals(100.0, order.getFilledQuantity());
        assertEquals(0.0, order.remainingQuantity());
        assertEquals(149.90, order.getAvgFillPrice(), 0.00001);
        assertTrue(order.isTerminal());
    }

    @Test
    public void testMarkCancelled() {
        Order order = new Order("AAPL", Order.Side.BUY, Order.OrderType.LIMIT, 100, 150.0, 0.0);
        order.markCancelled();
        assertEquals(Order.Status.CANCELLED, order.getStatus());
        assertTrue(order.isTerminal());
    }

    @Test
    public void testMarkRejected() {
        Order order = new Order("AAPL", Order.Side.BUY, Order.OrderType.LIMIT, 100, 150.0, 0.0);
        order.markRejected("Risk limit exceeded");
        assertEquals(Order.Status.REJECTED, order.getStatus());
        assertEquals("Risk limit exceeded", order.getRejectReason());
        assertTrue(order.isTerminal());
    }
}
