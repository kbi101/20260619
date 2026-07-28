package com.quantstation.strategy.multiresolution;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MultiResolutionSimServiceTest {

    private MultiResolutionStrategy strategy;
    private MultiResolutionSimService simService;

    @BeforeEach
    void setUp() {
        strategy = new MultiResolutionStrategy();
        simService = new MultiResolutionSimService(strategy);
    }

    @Test
    void testInjectBullishOversoldScenario() {
        MultiResolutionStrategy.SymbolConsensusResult result =
                simService.injectScenario("SPY", MultiResolutionSimService.ScenarioType.BULLISH_OVERSOLD);

        assertNotNull(result);
        assertEquals("SPY", result.symbol());
        assertTrue(result.signals().size() >= 6);
        assertNotNull(result.consensusCode());
    }

    @Test
    void testInjectOverboughtRallyScenario() {
        MultiResolutionStrategy.SymbolConsensusResult result =
                simService.injectScenario("QQQ", MultiResolutionSimService.ScenarioType.OVERBOUGHT_RALLY);

        assertNotNull(result);
        assertEquals("QQQ", result.symbol());
    }

    @Test
    void testInjectVolatilityShockScenario() {
        MultiResolutionStrategy.SymbolConsensusResult result =
                simService.injectScenario("IWM", MultiResolutionSimService.ScenarioType.VOLATILITY_SHOCK);

        assertNotNull(result);
        assertEquals("IWM", result.symbol());
    }
}
