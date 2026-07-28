package com.quantstation.strategy.multiresolution;

import com.quantstation.domain.BarData;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class IndicatorCalculatorTest {

    @Test
    void testComputeZScore() {
        double[] prices = new double[20];
        for (int i = 0; i < 20; i++) {
            prices[i] = 100.0 + i;
        }
        double z = IndicatorCalculator.computeZScore(prices, 20);
        assertTrue(z > 1.0, "Z-Score for strictly ascending prices should be positive > 1.0");
    }

    @Test
    void testComputeIndicatorsFull() {
        List<BarData> bars = new ArrayList<>();
        Instant baseTime = Instant.parse("2026-07-28T10:00:00Z");

        for (int i = 0; i < 30; i++) {
            double px = 500.0 + (i % 2 == 0 ? i : -i);
            bars.add(new BarData(
                    "SPY", "5m",
                    px, px + 2.0, px - 2.0, px + 0.5,
                    5000, px, 100,
                    baseTime.plusSeconds(i * 300L), baseTime.plusSeconds((i + 1) * 300L), baseTime.plusSeconds((i + 1) * 300L)
            ));
        }

        IndicatorCalculator.IndicatorSnapshot snapshot = IndicatorCalculator.computeIndicators(bars);
        assertNotNull(snapshot);
        assertTrue(snapshot.rsi() >= 0.0 && snapshot.rsi() <= 100.0);
        assertTrue(snapshot.adx() >= 0.0 && snapshot.adx() <= 100.0);
        assertTrue(snapshot.regime() == 0 || snapshot.regime() == 1);
    }
}
