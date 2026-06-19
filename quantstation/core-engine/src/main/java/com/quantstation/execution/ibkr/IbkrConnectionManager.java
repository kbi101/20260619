package com.quantstation.execution.ibkr;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Manages the TCP socket connection to the local IB Gateway container.
 *
 * <p>Handles:
 * <ul>
 *   <li>Connection establishment to IB Gateway on localhost:4002 (paper)</li>
 *   <li>Automatic reconnection with configurable backoff</li>
 *   <li>Connection health monitoring</li>
 *   <li>Graceful disconnection on shutdown</li>
 * </ul>
 *
 * <p><strong>Note:</strong> The actual TWS API client (EClientSocket) will be initialized
 * here once the IB TWS API JARs are added to the build. This class currently provides
 * the connection lifecycle framework.
 */
@Component
public class IbkrConnectionManager {

    private static final Logger log = LoggerFactory.getLogger(IbkrConnectionManager.class);

    @Value("${quantstation.ibkr.host:localhost}")
    private String host;

    @Value("${quantstation.ibkr.port:4002}")
    private int port;

    @Value("${quantstation.ibkr.client-id:1}")
    private int clientId;

    @Value("${quantstation.ibkr.connect-timeout-ms:5000}")
    private int connectTimeoutMs;

    @Value("${quantstation.ibkr.reconnect-delay-ms:3000}")
    private int reconnectDelayMs;

    @Value("${quantstation.ibkr.max-reconnect-attempts:10}")
    private int maxReconnectAttempts;

    private final AtomicBoolean connected = new AtomicBoolean(false);
    private final AtomicInteger nextOrderId = new AtomicInteger(0);

    // TODO: EClientSocket client; — initialized with TWS API JARs
    // TODO: EReaderSignal signal;

    @PostConstruct
    public void init() {
        log.info("IbkrConnectionManager: Configured for {}:{} (clientId={})",
                host, port, clientId);
        // Connection will be attempted when IB Gateway is available
        // connect();
    }

    /**
     * Establish connection to IB Gateway.
     */
    public void connect() {
        if (connected.get()) {
            log.warn("IbkrConnectionManager: Already connected");
            return;
        }

        log.info("IbkrConnectionManager: Connecting to IB Gateway at {}:{}", host, port);

        // TODO: Implement with TWS API:
        // signal = new EJavaSignal();
        // client = new EClientSocket(callbackHandler, signal);
        // client.eConnect(host, port, clientId);
        //
        // // Start reader thread
        // EReader reader = new EReader(client, signal);
        // reader.start();
        //
        // // Message processing on virtual thread
        // Thread.startVirtualThread(() -> {
        //     while (client.isConnected()) {
        //         signal.waitForSignal();
        //         reader.processMsgs();
        //     }
        // });

        log.info("IbkrConnectionManager: Connection framework ready (awaiting TWS API JARs)");
    }

    /**
     * Disconnect from IB Gateway.
     */
    @PreDestroy
    public void disconnect() {
        if (connected.compareAndSet(true, false)) {
            log.info("IbkrConnectionManager: Disconnecting from IB Gateway");
            // TODO: client.eDisconnect();
        }
    }

    /**
     * Returns the next valid order ID (assigned by IB Gateway on connect).
     */
    public int getNextOrderId() {
        return nextOrderId.getAndIncrement();
    }

    /**
     * Set the initial next order ID (called from EWrapper.nextValidId).
     */
    public void setNextOrderId(int orderId) {
        nextOrderId.set(orderId);
    }

    public boolean isConnected() {
        return connected.get();
    }

    public String getHost() { return host; }
    public int getPort() { return port; }
}
