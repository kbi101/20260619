package com.quantstation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * QuantStation Core Engine — Entry Point.
 *
 * <p>Central nervous system bridging the Execution Plane (order routing via IB Gateway)
 * and the Data Fabric (Redis live state + QuestDB time-series storage).
 *
 * <p>Runs on Java 21 with Virtual Threads (Project Loom) for high-concurrency
 * WebSocket session management and market data fan-out.
 */
@SpringBootApplication
@EnableAsync
@EnableScheduling
public class QuantStationApp {

    private static final Logger log = LoggerFactory.getLogger(QuantStationApp.class);

    public static void main(String[] args) {
        log.info("═══════════════════════════════════════════");
        log.info("  QuantStation Core Engine — Starting...");
        log.info("  Java {} / {}", System.getProperty("java.version"),
                System.getProperty("java.vm.name"));
        log.info("  Virtual Threads: enabled");
        log.info("═══════════════════════════════════════════");

        SpringApplication.run(QuantStationApp.class, args);
    }
}
