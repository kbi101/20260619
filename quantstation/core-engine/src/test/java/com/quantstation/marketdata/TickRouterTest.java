package com.quantstation.marketdata;

import com.quantstation.domain.Tick;
import com.quantstation.repository.QuestDbTickWriter;
import com.quantstation.repository.RedisStateRepository;
import com.quantstation.strategy.StrategyEngine;
import com.quantstation.web.UiWebSocketController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;

import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

public class TickRouterTest {

    private RedisStateRepository redisState;
    private QuestDbTickWriter questDbWriter;
    private StrategyEngine strategyEngine;
    private UiWebSocketController uiPush;
    private TickRouter tickRouter;

    @BeforeEach
    public void setUp() {
        redisState = mock(RedisStateRepository.class);
        questDbWriter = mock(QuestDbTickWriter.class);
        strategyEngine = mock(StrategyEngine.class);
        uiPush = mock(UiWebSocketController.class);

        tickRouter = new TickRouter(redisState, questDbWriter, strategyEngine, uiPush);
        ReflectionTestUtils.setField(tickRouter, "uiPushIntervalMs", 50);
    }

    @Test
    public void testOnTickFanningAndThrottling() {
        Tick tick1 = Tick.trade("AAPL", 150.0, 100, "NASDAQ", Instant.now());
        Tick tick2 = Tick.trade("AAPL", 150.5, 200, "NASDAQ", Instant.now());
        Tick tick3 = Tick.trade("MSFT", 300.0, 50, "NYSE", Instant.now());

        // 1. Process tick1
        tickRouter.onTick(tick1);
        verify(redisState).updateLastPrice("AAPL", 150.0);
        verify(questDbWriter).bufferTick(tick1);
        verify(strategyEngine).onTick(tick1);

        // 2. Process tick2 (latest for AAPL)
        tickRouter.onTick(tick2);
        verify(redisState).updateLastPrice("AAPL", 150.5);
        verify(questDbWriter).bufferTick(tick2);
        verify(strategyEngine).onTick(tick2);

        // 3. Process tick3 (MSFT)
        tickRouter.onTick(tick3);
        verify(redisState).updateLastPrice("MSFT", 300.0);
        verify(questDbWriter).bufferTick(tick3);
        verify(strategyEngine).onTick(tick3);

        // Verify that UI has not received any ticks yet since flushToUi hasn't run
        verify(uiPush, never()).pushTick(any());

        // 4. Manually flush to UI (simulating scheduler tick)
        ReflectionTestUtils.invokeMethod(tickRouter, "flushToUi");

        // Verify that uiPush received AAPL (tick2, since it was latest) and MSFT (tick3)
        verify(uiPush).pushTick(tick2);
        verify(uiPush).pushTick(tick3);
        verify(uiPush, never()).pushTick(tick1); // Throttled out

        // 5. Subsequent flush should be a no-op (cleared buffer)
        reset(uiPush);
        ReflectionTestUtils.invokeMethod(tickRouter, "flushToUi");
        verify(uiPush, never()).pushTick(any());
    }

    @Test
    public void testGetLatestTick() {
        Tick tick = Tick.trade("AAPL", 150.0, 100, "NASDAQ", Instant.now());
        tickRouter.onTick(tick);
        assertEquals(tick, tickRouter.getLatestTick("AAPL"));
    }
}
