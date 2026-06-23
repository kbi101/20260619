package com.quantstation.repository;

import com.quantstation.domain.Tick;
import io.questdb.client.Sender;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.time.temporal.ChronoUnit;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * High-throughput batch writer for QuestDB using InfluxDB Line Protocol (ILP).
 *
 * <p>Ticks are buffered in a lock-free queue and flushed at configurable intervals
 * (default: 100ms). This prevents individual tick writes from blocking the hot path.
 *
 * <p>Writes to the {@code ticks} table defined in schema-init.sql.
 */
@Repository
public class QuestDbTickWriter {

    private static final Logger log = LoggerFactory.getLogger(QuestDbTickWriter.class);

    private final Sender sender;

    @Value("${quantstation.questdb.flush-interval-ms:100}")
    private int flushIntervalMs;

    @Value("${quantstation.questdb.batch-size:1000}")
    private int batchSize;

    private final Queue<Tick> tickBuffer = new ConcurrentLinkedQueue<>();
    private final AtomicLong totalWritten = new AtomicLong(0);
    private final AtomicLong totalDropped = new AtomicLong(0);

    private ScheduledExecutorService flushScheduler;

    public QuestDbTickWriter(Sender sender) {
        this.sender = sender;
    }

    @PostConstruct
    public void init() {
        flushScheduler = Executors.newSingleThreadScheduledExecutor(
                Thread.ofVirtual().name("questdb-flusher-", 0).factory()
        );

        flushScheduler.scheduleAtFixedRate(
                this::flush,
                flushIntervalMs,
                flushIntervalMs,
                TimeUnit.MILLISECONDS
        );

        log.info("QuestDbTickWriter: Flush scheduler started ({}ms interval, batch={})",
                flushIntervalMs, batchSize);
    }

    @PreDestroy
    public void shutdown() {
        log.info("QuestDbTickWriter: Shutting down — flushing remaining buffer");
        flush(); // Final flush
        if (flushScheduler != null) {
            flushScheduler.shutdown();
        }
        log.info("QuestDbTickWriter: Total written={}, dropped={}",
                totalWritten.get(), totalDropped.get());
    }

    /**
     * Buffer a tick for batch writing. Lock-free, non-blocking.
     * Called from the hot path (TickRouter.onTick).
     */
    public void bufferTick(Tick tick) {
        // Simple backpressure: drop if buffer exceeds 10x batch size
        if (tickBuffer.size() > batchSize * 10) {
            totalDropped.incrementAndGet();
            return;
        }
        tickBuffer.offer(tick);
    }

    /**
     * Flush buffered ticks to QuestDB via ILP.
     */
    private void flush() {
        if (tickBuffer.isEmpty()) return;

        int count = 0;
        try {
            Tick tick;
            while (count < batchSize && (tick = tickBuffer.poll()) != null) {
                Sender row = sender.table("ticks")
                        .symbol("symbol", tick.symbol())
                        .doubleColumn("price", tick.price())
                        .longColumn("size", tick.size());
                
                if (tick.exchange() != null && !tick.exchange().isEmpty()) {
                    row = row.symbol("exchange", tick.exchange());
                }
                if (tick.conditions() != null && !tick.conditions().isEmpty()) {
                    row = row.symbol("conditions", tick.conditions());
                }
                
                row.at(tick.timestamp().truncatedTo(ChronoUnit.MICROS));
                count++;
            }
            sender.flush();
            totalWritten.addAndGet(count);
        } catch (Exception e) {
            log.error("QuestDbTickWriter: Flush failed after {} rows", count, e);
            totalDropped.addAndGet(tickBuffer.size());
            tickBuffer.clear(); // Drop remaining to prevent memory pressure
        }
    }

    // ── Monitoring ──────────────────────────────────

    public long getTotalWritten() { return totalWritten.get(); }
    public long getTotalDropped() { return totalDropped.get(); }
    public int getBufferSize() { return tickBuffer.size(); }
}
