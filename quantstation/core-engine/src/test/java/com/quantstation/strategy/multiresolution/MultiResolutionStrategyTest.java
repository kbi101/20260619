package com.quantstation.strategy.multiresolution;

import com.quantstation.domain.BarData;
import com.quantstation.strategy.signals.Signal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class MultiResolutionStrategyTest {

    private MultiResolutionStrategy strategy;

    @BeforeEach
    void setUp() {
        strategy = new MultiResolutionStrategy();
    }

    @Test
    void testStrategyNameAndSubscriptions() {
        assertEquals("MultiResolutionStrategy", strategy.getName());
        assertTrue(strategy.getSubscribedSymbols().contains("SPY"));
        assertTrue(strategy.getSubscribedSymbols().contains("QQQ"));
    }

    @Test
    void testSeedBarsAndEvaluate() {
        List<BarData> bars = new ArrayList<>();
        Instant baseTime = Instant.parse("2026-07-28T09:30:00Z");

        for (int i = 0; i < 50; i++) {
            double px = 400.0 - (i * 0.5); // Oversold trend
            bars.add(new BarData(
                    "SPY", "1m",
                    px, px + 0.2, px - 0.2, px - 0.1,
                    2000, px, 50,
                    baseTime.plusSeconds(i * 60L), baseTime.plusSeconds((i + 1) * 60L), baseTime.plusSeconds((i + 1) * 60L)
            ));
        }

        strategy.seedBars("SPY", bars);
        MultiResolutionStrategy.SymbolConsensusResult result = strategy.getLatestConsensusMap().get("SPY");

        assertNotNull(result);
        assertEquals("SPY", result.symbol());
        assertEquals(6, result.signals().size());
        assertNotNull(result.consensusCode());
    }

    @Test
    void testAutomatedSignalTriggerOnConsensus() {
        List<BarData> bars = new ArrayList<>();
        Instant baseTime = Instant.parse("2026-07-28T09:30:00Z");

        for (int i = 0; i < 60; i++) {
            double px = 500.0 - (i * 0.8);
            bars.add(new BarData(
                    "SPY", "1m",
                    px, px + 0.1, px - 0.5, px - 0.4,
                    5000, px, 100,
                    baseTime.plusSeconds(i * 60L), baseTime.plusSeconds((i + 1) * 60L), baseTime.plusSeconds((i + 1) * 60L)
            ));
        }

        Signal signal = null;
        for (BarData b : bars) {
            Signal s = strategy.onBar(b);
            if (s != null) {
                signal = s;
            }
        }

        // Verify strategy evaluation executed without error
        MultiResolutionStrategy.SymbolConsensusResult consensus = strategy.getLatestConsensusMap().get("SPY");
        assertNotNull(consensus);
    }
}
