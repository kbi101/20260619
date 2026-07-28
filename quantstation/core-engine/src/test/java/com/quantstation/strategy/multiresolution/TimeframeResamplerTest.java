package com.quantstation.strategy.multiresolution;

import com.quantstation.domain.BarData;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TimeframeResamplerTest {

    @Test
    void testResample1mTo5m() {
        List<BarData> bars1m = new ArrayList<>();
        Instant baseTime = Instant.parse("2026-07-28T14:00:00Z");

        for (int i = 0; i < 10; i++) {
            Instant tStart = baseTime.plusSeconds(i * 60L);
            Instant tEnd = tStart.plusSeconds(60L);
            bars1m.add(new BarData(
                    "SPY", "1m",
                    100.0 + i, 105.0 + i, 99.0 + i, 102.0 + i,
                    1000, 101.5, 50,
                    tStart, tEnd, tEnd
            ));
        }

        List<BarData> resample5m = TimeframeResampler.resample(bars1m, "5m");
        assertEquals(2, resample5m.size());

        BarData first5m = resample5m.get(0);
        assertEquals("SPY", first5m.symbol());
        assertEquals("5m", first5m.timeframe());
        assertEquals(100.0, first5m.open());
        assertEquals(102.0 + 4, first5m.close());
        assertEquals(105.0 + 4, first5m.high());
        assertEquals(99.0, first5m.low());
        assertEquals(5000, first5m.volume());
    }

    @Test
    void testParseTimeframeMinutes() {
        assertEquals(2, TimeframeResampler.parseTimeframeMinutes("2m"));
        assertEquals(5, TimeframeResampler.parseTimeframeMinutes("5m"));
        assertEquals(15, TimeframeResampler.parseTimeframeMinutes("15m"));
        assertEquals(30, TimeframeResampler.parseTimeframeMinutes("30m"));
        assertEquals(60, TimeframeResampler.parseTimeframeMinutes("1h"));
        assertEquals(240, TimeframeResampler.parseTimeframeMinutes("4h"));
    }
}
