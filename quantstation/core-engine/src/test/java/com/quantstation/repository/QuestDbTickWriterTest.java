package com.quantstation.repository;

import com.quantstation.domain.Tick;
import io.questdb.client.Sender;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;

import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

public class QuestDbTickWriterTest {

    private Sender sender;
    private QuestDbTickWriter tickWriter;

    @BeforeEach
    public void setUp() {
        sender = mock(Sender.class);
        // Stub all fluent interface methods of QuestDB Sender
        when(sender.table(anyString())).thenReturn(sender);
        when(sender.symbol(anyString(), anyString())).thenReturn(sender);
        when(sender.doubleColumn(anyString(), anyDouble())).thenReturn(sender);
        when(sender.longColumn(anyString(), anyLong())).thenReturn(sender);
        
        tickWriter = new QuestDbTickWriter(sender);
        ReflectionTestUtils.setField(tickWriter, "flushIntervalMs", 100);
        ReflectionTestUtils.setField(tickWriter, "batchSize", 5);
    }

    @Test
    public void testBufferAndFlushBatch() {
        // Buffer 3 ticks
        tickWriter.bufferTick(Tick.trade("AAPL", 150.0, 100, "NASDAQ", Instant.now()));
        tickWriter.bufferTick(Tick.trade("AAPL", 150.1, 200, "NASDAQ", Instant.now()));
        tickWriter.bufferTick(Tick.trade("MSFT", 300.0, 50, "NYSE", Instant.now()));

        assertEquals(3, tickWriter.getBufferSize());
        assertEquals(0, tickWriter.getTotalWritten());

        // Manually flush
        ReflectionTestUtils.invokeMethod(tickWriter, "flush");

        assertEquals(0, tickWriter.getBufferSize());
        assertEquals(3, tickWriter.getTotalWritten());
        assertEquals(0, tickWriter.getTotalDropped());

        // Verify sender operations
        verify(sender, times(3)).table("ticks");
        verify(sender, times(2)).symbol("symbol", "AAPL");
        verify(sender, times(1)).symbol("symbol", "MSFT");
        verify(sender).flush();
    }

    @Test
    public void testBatchSizeBoundary() {
        // batchSize is set to 5. Buffer 7 ticks.
        for (int i = 0; i < 7; i++) {
            tickWriter.bufferTick(Tick.trade("AAPL", 150.0 + i, 100, "NASDAQ", Instant.now()));
        }

        assertEquals(7, tickWriter.getBufferSize());

        // Manually flush once
        ReflectionTestUtils.invokeMethod(tickWriter, "flush");

        // Should have flushed exactly 5 (the batch size), leaving 2 in buffer
        assertEquals(2, tickWriter.getBufferSize());
        assertEquals(5, tickWriter.getTotalWritten());

        // Flush again to clear the rest
        ReflectionTestUtils.invokeMethod(tickWriter, "flush");
        assertEquals(0, tickWriter.getBufferSize());
        assertEquals(7, tickWriter.getTotalWritten());
    }

    @Test
    public void testBackpressureDropping() {
        // batchSize is 5. Max buffer size = 10 * batchSize = 50.
        // With size > 50 check, the 51st item gets accepted (size becomes 51), and subsequent 4 are dropped.
        for (int i = 0; i < 55; i++) {
            tickWriter.bufferTick(Tick.trade("AAPL", 150.0, 100, "NASDAQ", Instant.now()));
        }

        assertEquals(51, tickWriter.getBufferSize());
        assertEquals(4, tickWriter.getTotalDropped());

        // Flush
        ReflectionTestUtils.invokeMethod(tickWriter, "flush");
        assertEquals(46, tickWriter.getBufferSize());
        assertEquals(5, tickWriter.getTotalWritten());
    }

    @Test
    public void testShutdownFlush() {
        tickWriter.bufferTick(Tick.trade("AAPL", 150.0, 100, "NASDAQ", Instant.now()));
        assertEquals(1, tickWriter.getBufferSize());

        // Call shutdown
        tickWriter.shutdown();

        // Should have flushed on shutdown
        assertEquals(0, tickWriter.getBufferSize());
        assertEquals(1, tickWriter.getTotalWritten());
    }
}
