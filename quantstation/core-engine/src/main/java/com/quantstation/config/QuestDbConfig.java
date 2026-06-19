package com.quantstation.config;

import io.questdb.client.Sender;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * QuestDB configuration for high-throughput tick ingestion.
 *
 * <p>Uses the InfluxDB Line Protocol (ILP) client for maximum write speed.
 * The ILP sender buffers rows and flushes at configurable intervals.
 *
 * <p>QuestDB runs locally in Docker on port 9009 (ILP) and 8812 (PG Wire for queries).
 */
@Configuration
public class QuestDbConfig {

    private static final Logger log = LoggerFactory.getLogger(QuestDbConfig.class);

    @Value("${quantstation.questdb.host:localhost}")
    private String host;

    @Value("${quantstation.questdb.ilp-port:9009}")
    private int ilpPort;

    /**
     * Creates an ILP Sender for high-throughput tick data ingestion.
     * The sender maintains a persistent TCP connection to QuestDB.
     */
    @Bean(destroyMethod = "close")
    public Sender questDbSender() {
        log.info("Connecting QuestDB ILP sender to {}:{}", host, ilpPort);
        return Sender.builder(Sender.Transport.TCP)
                .address(host + ":" + ilpPort)
                .build();
    }
}
