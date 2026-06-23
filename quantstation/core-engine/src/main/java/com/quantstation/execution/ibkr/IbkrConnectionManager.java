package com.quantstation.execution.ibkr;

import com.ib.client.EClientSocket;
import com.ib.client.EJavaSignal;
import com.ib.client.EReader;
import com.ib.client.EReaderSignal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Manages the TCP socket connection to the local IB Gateway container.
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
    private final AtomicBoolean reconnecting = new AtomicBoolean(false);
    private final AtomicBoolean shouldReconnect = new AtomicBoolean(true);
    private final AtomicInteger nextOrderId = new AtomicInteger(0);
    private final ObjectProvider<IbkrCallbackHandler> callbackHandlerProvider;
    private final IbkrConfigService configService;

    private EClientSocket client;
    private EReaderSignal signal;

    public IbkrConnectionManager(ObjectProvider<IbkrCallbackHandler> callbackHandlerProvider,
                                 IbkrConfigService configService) {
        this.callbackHandlerProvider = callbackHandlerProvider;
        this.configService = configService;
    }

    @PostConstruct
    public void init() {
        log.info("IbkrConnectionManager: Configured for {}:{} (clientId={})",
                host, port, clientId);
    }

    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    public void onApplicationReady() {
        shouldReconnect.set(true);
        Thread.startVirtualThread(this::connectWithRetry);
    }

    public void startConnection(String mode) {
        if ("live".equalsIgnoreCase(mode)) {
            this.port = 4001;
        } else {
            this.port = 4002;
        }
        log.info("IbkrConnectionManager: Requesting connection on port {}", this.port);
        shouldReconnect.set(true);
        disconnect();
        Thread.startVirtualThread(this::connectWithRetry);
    }

    private void connectWithRetry() {
        if (!shouldReconnect.get()) {
            log.info("IbkrConnectionManager: shouldReconnect is false, skipping connection attempt");
            return;
        }
        if (!reconnecting.compareAndSet(false, true)) {
            log.warn("IbkrConnectionManager: Connection loop already active, skipping trigger");
            return;
        }
        try {
            int attempt = 0;
            while (shouldReconnect.get() && attempt < maxReconnectAttempts) {
                if (!isConnected()) {
                    attempt++;
                    log.info("IbkrConnectionManager: Connection attempt {}/{}", attempt, maxReconnectAttempts);
                    connect();
                } else {
                    attempt = 0; // Reset attempts once connected
                }
                try {
                    Thread.sleep(reconnectDelayMs);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    log.error("IbkrConnectionManager: Reconnection loop interrupted", e);
                    break;
                }
            }
            if (!isConnected() && shouldReconnect.get()) {
                log.error("IbkrConnectionManager: Failed to connect to IB Gateway after {} attempts", maxReconnectAttempts);
            }
        } finally {
            reconnecting.set(false);
        }
    }

    /**
     * Establish connection to IB Gateway.
     */
    public void connect() {
        if (isConnected()) {
            log.warn("IbkrConnectionManager: Already connected");
            return;
        }

        log.info("IbkrConnectionManager: Connecting to IB Gateway at {}:{}", host, port);

        try {
            IbkrCallbackHandler callbackHandler = callbackHandlerProvider.getObject();
            signal = new EJavaSignal();
            client = new EClientSocket(callbackHandler, signal);
            
            client.eConnect(host, port, clientId);

            if (client.isConnected()) {
                connected.set(true);
                log.info("IbkrConnectionManager: Successfully connected to IB Gateway");

                // Immediately wipe credentials from config.ini
                configService.wipeCredentials();

                // Request delayed market data fallback (3) so tick streams function without paid real-time subscriptions
                try {
                    client.reqMarketDataType(3);
                    log.info("IbkrConnectionManager: Set market data type to DELAYED (3)");
                } catch (Exception e) {
                    log.error("IbkrConnectionManager: Failed to set market data type to DELAYED", e);
                }

                // Start reader thread
                EReader reader = new EReader(client, signal);
                reader.start();

                // Message processing on virtual thread
                Thread.startVirtualThread(() -> {
                    while (client != null && client.isConnected()) {
                        signal.waitForSignal();
                        try {
                            reader.processMsgs();
                        } catch (Exception e) {
                            log.error("IbkrConnectionManager: Error processing messages", e);
                        }
                    }
                    connected.set(false);
                    log.warn("IbkrConnectionManager: IB Gateway connection closed, reader thread stopped");
                });
            } else {
                log.error("IbkrConnectionManager: Connection failed to establish");
            }
        } catch (Exception e) {
            log.error("IbkrConnectionManager: Connection failed with exception", e);
        }
    }

    /**
     * Disconnect from IB Gateway.
     */
    @PreDestroy
    public void disconnect() {
        shouldReconnect.set(false);
        if (connected.compareAndSet(true, false)) {
            log.info("IbkrConnectionManager: Disconnecting from IB Gateway");
            if (client != null) {
                client.eDisconnect();
                client = null;
            }
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
        return connected.get() && client != null && client.isConnected();
    }

    public EClientSocket getClient() {
        return client;
    }

    public String getHost() { return host; }
    public int getPort() { return port; }
}
