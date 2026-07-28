package com.quantstation.strategy.multiresolution;

import com.quantstation.domain.BarData;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Synthetic Market Scenario Simulation Service for Multi-Resolution Signal Engine.
 */
@Service
public class MultiResolutionSimService {

    private static final Logger log = LoggerFactory.getLogger(MultiResolutionSimService.class);

    private final MultiResolutionStrategy strategy;

    public MultiResolutionSimService(MultiResolutionStrategy strategy) {
        this.strategy = strategy;
    }

    public enum ScenarioType {
        BULLISH_OVERSOLD,
        OVERBOUGHT_RALLY,
        VOLATILITY_SHOCK,
        NEUTRAL_RESET
    }

    public MultiResolutionStrategy.SymbolConsensusResult injectScenario(String symbol, ScenarioType scenario) {
        String sym = symbol.toUpperCase();
        log.info("MultiResolutionSimService: Injecting scenario '{}' for symbol '{}'", scenario, sym);

        List<BarData> syntheticBars = generateSyntheticBars(sym, scenario);
        strategy.seedBars(sym, syntheticBars);

        // Dispatch latest bar to trigger onBar evaluation
        if (!syntheticBars.isEmpty()) {
            strategy.onBar(syntheticBars.get(syntheticBars.size() - 1));
        }

        return strategy.evaluateSymbol(sym);
    }

    public List<BarData> generateSyntheticBars(String symbol, ScenarioType scenario) {
        List<BarData> bars = new ArrayList<>();
        Instant baseTime = Instant.now().minusSeconds(120 * 60L); // 2 hours of 1m bars

        double basePx = 500.0;
        int barCount = 120;

        for (int i = 0; i < barCount; i++) {
            Instant tStart = baseTime.plusSeconds(i * 60L);
            Instant tEnd = tStart.plusSeconds(60L);

            double open, high, low, close;
            long volume = 5000 + (i * 10L);

            switch (scenario) {
                case BULLISH_OVERSOLD -> {
                    // Stable for 80 bars, then steep linear drop creating Z < -2.0, low RSI, low ADX
                    if (i < 80) {
                        close = basePx + ((i % 3) * 0.1);
                    } else {
                        double dropFactor = (i - 80) * 0.45; // Drop ~18 points
                        close = basePx - dropFactor;
                    }
                    open = close + 0.2;
                    high = Math.max(open, close) + 0.1;
                    low = Math.min(open, close) - 0.1;
                }

                case OVERBOUGHT_RALLY -> {
                    // Stable for 80 bars, then steep rally creating Z > +2.0
                    if (i < 80) {
                        close = basePx - ((i % 3) * 0.1);
                    } else {
                        double rallyFactor = (i - 80) * 0.45;
                        close = basePx + rallyFactor;
                    }
                    open = close - 0.2;
                    high = Math.max(open, close) + 0.1;
                    low = Math.min(open, close) - 0.1;
                }

                case VOLATILITY_SHOCK -> {
                    // Wild price fluctuations (HighVol regime) with low Z-score
                    double jitter = (i % 2 == 0 ? 1.0 : -1.0) * (3.5 + (i * 0.05));
                    close = basePx + jitter;
                    open = close - (jitter * 0.5);
                    high = Math.max(open, close) + 1.5;
                    low = Math.min(open, close) - 1.5;
                    volume = 25000;
                }

                case NEUTRAL_RESET -> {
                    // Small noise around base price
                    double noise = (Math.sin(i * 0.2) * 0.5);
                    close = basePx + noise;
                    open = close - 0.1;
                    high = close + 0.2;
                    low = close - 0.2;
                }
                default -> {
                    close = basePx;
                    open = basePx;
                    high = basePx + 0.1;
                    low = basePx - 0.1;
                }
            }

            bars.add(new BarData(
                    symbol,
                    "1m",
                    open,
                    high,
                    low,
                    close,
                    volume,
                    close,
                    100,
                    tStart,
                    tEnd,
                    tEnd
            ));
        }

        return bars;
    }
}
