package com.quantstation.strategy.multiresolution;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MultiResolutionSpecRegistryTest {

    @Test
    void testGetTunedSymbolSpecs() {
        MultiResolutionSpec spy15m = MultiResolutionSpecRegistry.getSpec("SPY", "15m");
        System.out.println("SPY 15M SPEC: " + spy15m);
        assertNotNull(spy15m);
        assertEquals("SPY", spy15m.symbol());
        assertEquals("15m", spy15m.timeframe());
        assertEquals(1.1, spy15m.takeProfitZscore(), 0.001);
        assertEquals(0.8, spy15m.stopLossZscore(), 0.001);
        assertEquals(32.5, spy15m.maxRsiThreshold(), 0.001);
        assertTrue(spy15m.useHmmFilter());

        MultiResolutionSpec qqq15m = MultiResolutionSpecRegistry.getSpec("QQQ", "15m");
        assertNotNull(qqq15m);
        assertEquals(0.8, qqq15m.takeProfitZscore(), 0.001);
        assertEquals(0.5, qqq15m.stopLossZscore(), 0.001);
    }

    @Test
    void testStaplesSectorInheritance() {
        MultiResolutionSpec wmt15m = MultiResolutionSpecRegistry.getSpec("WMT", "15m");
        assertNotNull(wmt15m);
        assertEquals("WMT", wmt15m.symbol());
        // WMT inherits XLP 15m spec (takeProfitZscore=2.3, stopLossZscore=0.9, maxAdx=30.0)
        assertEquals(2.3, wmt15m.takeProfitZscore(), 0.001);
        assertEquals(0.9, wmt15m.stopLossZscore(), 0.001);
        assertEquals(30.0, wmt15m.maxAdxThreshold(), 0.001);
    }
}
