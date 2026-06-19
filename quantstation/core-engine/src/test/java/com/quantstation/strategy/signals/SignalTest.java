package com.quantstation.strategy.signals;

import com.quantstation.domain.Order;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class SignalTest {

    @Test
    public void testMarketBuyFactory() {
        Signal signal = Signal.marketBuy("MeanReversion", "AAPL", 10.0, "Oversold condition");
        assertNotNull(signal.signalId());
        assertEquals("MeanReversion", signal.strategyName());
        assertEquals("AAPL", signal.symbol());
        assertEquals(Order.Side.BUY, signal.side());
        assertEquals(Order.OrderType.MARKET, signal.orderType());
        assertEquals(10.0, signal.quantity());
        assertEquals(0.0, signal.limitPrice());
        assertEquals(0.0, signal.stopPrice());
        assertEquals(1.0, signal.confidence());
        assertEquals("Oversold condition", signal.reason());
        assertNotNull(signal.timestamp());
    }

    @Test
    public void testMarketSellFactory() {
        Signal signal = Signal.marketSell("MeanReversion", "AAPL", 15.0, "Take profit");
        assertNotNull(signal.signalId());
        assertEquals("MeanReversion", signal.strategyName());
        assertEquals("AAPL", signal.symbol());
        assertEquals(Order.Side.SELL, signal.side());
        assertEquals(Order.OrderType.MARKET, signal.orderType());
        assertEquals(15.0, signal.quantity());
        assertEquals(0.0, signal.limitPrice());
        assertEquals(0.0, signal.stopPrice());
        assertEquals(1.0, signal.confidence());
        assertEquals("Take profit", signal.reason());
        assertNotNull(signal.timestamp());
    }

    @Test
    public void testLimitBuyFactory() {
        Signal signal = Signal.limitBuy("MeanReversion", "AAPL", 20.0, 150.5, "Support level");
        assertNotNull(signal.signalId());
        assertEquals("MeanReversion", signal.strategyName());
        assertEquals("AAPL", signal.symbol());
        assertEquals(Order.Side.BUY, signal.side());
        assertEquals(Order.OrderType.LIMIT, signal.orderType());
        assertEquals(20.0, signal.quantity());
        assertEquals(150.5, signal.limitPrice());
        assertEquals(0.0, signal.stopPrice());
        assertEquals(1.0, signal.confidence());
        assertEquals("Support level", signal.reason());
        assertNotNull(signal.timestamp());
    }

    @Test
    public void testToOrderConversion() {
        Signal signal = new Signal(
                "sig-123", "TrendFollowing", "MSFT", Order.Side.BUY, Order.OrderType.LIMIT,
                50.0, 310.0, 0.0, 0.85, "Breakout", java.time.Instant.now()
        );

        Order order = signal.toOrder();
        assertNotNull(order.getOrderId()); // orderId is randomly generated in Order constructor
        assertNotEquals("sig-123", order.getOrderId());
        assertEquals("MSFT", order.getSymbol());
        assertEquals(Order.Side.BUY, order.getSide());
        assertEquals(Order.OrderType.LIMIT, order.getOrderType());
        assertEquals(50.0, order.getQuantity());
        assertEquals(310.0, order.getLimitPrice());
        assertEquals(0.0, order.getStopPrice());
        assertEquals(Order.Status.PENDING, order.getStatus());
    }
}
