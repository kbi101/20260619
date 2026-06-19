package com.quantstation.domain;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class PositionTest {

    @Test
    public void testInitialState() {
        Position pos = new Position("AAPL");
        assertEquals("AAPL", pos.getSymbol());
        assertEquals(0.0, pos.getQuantity());
        assertEquals(0.0, pos.getAvgCost());
        assertEquals(0.0, pos.getMarketPrice());
        assertEquals(0.0, pos.getUnrealizedPnl());
        assertEquals(0.0, pos.getRealizedPnl());
        assertEquals(0.0, pos.totalPnl());
        assertTrue(pos.isFlat());
        assertFalse(pos.isLong());
        assertFalse(pos.isShort());
    }

    @Test
    public void testOpenAndAddLong() {
        Position pos = new Position("AAPL");
        
        // 1. Open Long: Buy 100 @ 150.0
        pos.applyFill(100.0, 150.0);
        assertEquals(100.0, pos.getQuantity());
        assertEquals(150.0, pos.getAvgCost());
        assertFalse(pos.isFlat());
        assertTrue(pos.isLong());
        assertFalse(pos.isShort());
        
        // 2. Add to Long: Buy 50 @ 156.0
        // Expected avgCost = ((100 * 150) + (50 * 156)) / 150 = (15000 + 7800) / 150 = 22800 / 150 = 152.0
        pos.applyFill(50.0, 156.0);
        assertEquals(150.0, pos.getQuantity());
        assertEquals(152.0, pos.getAvgCost());
        assertEquals(0.0, pos.getRealizedPnl());
    }

    @Test
    public void testReduceLong() {
        Position pos = new Position("AAPL");
        pos.applyFill(150.0, 152.0); // Long 150 @ 152.0
        
        // Reduce Long: Sell 50 @ 160.0
        // Realized PnL = 50 * (160 - 152) = 400.0
        pos.applyFill(-50.0, 160.0);
        assertEquals(100.0, pos.getQuantity());
        assertEquals(152.0, pos.getAvgCost()); // Cost basis does not change on reduction
        assertEquals(400.0, pos.getRealizedPnl());
    }

    @Test
    public void testFlipLongToShort() {
        Position pos = new Position("AAPL");
        pos.applyFill(100.0, 150.0); // Long 100 @ 150.0
        
        // Flip to Short: Sell 150 @ 160.0
        // Closes 100 long, opens 50 short
        // Realized PnL from closing long = 100 * (160 - 150) = 1000.0
        // Quantity becomes -50, avgCost becomes 160.0
        pos.applyFill(-150.0, 160.0);
        assertEquals(-50.0, pos.getQuantity());
        assertEquals(160.0, pos.getAvgCost());
        assertEquals(1000.0, pos.getRealizedPnl());
        assertTrue(pos.isShort());
        assertFalse(pos.isLong());
        assertFalse(pos.isFlat());
    }

    @Test
    public void testUnrealizedPnlAndMarketPriceUpdates() {
        Position pos = new Position("AAPL");
        
        // 1. Long position
        pos.applyFill(100.0, 150.0); // Long 100 @ 150.0
        pos.updateMarketPrice(155.0);
        
        assertEquals(155.0, pos.getMarketPrice());
        assertEquals(500.0, pos.getUnrealizedPnl()); // (155 - 150) * 100
        assertEquals(500.0, pos.totalPnl());

        pos.updateMarketPrice(145.0);
        assertEquals(-500.0, pos.getUnrealizedPnl()); // (145 - 150) * 100
        
        // 2. Short position
        pos.applyFill(-200.0, 145.0); // Flip to short: Sell 200 @ 145.0
        // Closes 100 long @ 145.0 (realized PnL: 100 * (145 - 150) = -500)
        // Opens 100 short @ 145.0
        assertEquals(-500.0, pos.getRealizedPnl());
        assertEquals(-100.0, pos.getQuantity());
        assertEquals(145.0, pos.getAvgCost());
        
        pos.updateMarketPrice(140.0);
        assertEquals(500.0, pos.getUnrealizedPnl()); // (140 - 145) * -100 = 500.0
        assertEquals(0.0, pos.totalPnl()); // realized PnL (-500) + unrealized PnL (500) = 0.0
    }
}
