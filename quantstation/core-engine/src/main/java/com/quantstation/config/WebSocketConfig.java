package com.quantstation.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket + STOMP configuration for the Electron UI connection.
 *
 * <p>The Electron workspace connects via {@code ws://localhost:8080/ws}
 * and subscribes to STOMP topics for real-time data push:
 * <ul>
 *   <li>{@code /topic/ticks/{symbol}} — Live market ticks</li>
 *   <li>{@code /topic/orders} — Order status updates</li>
 *   <li>{@code /topic/pnl} — PnL snapshots</li>
 *   <li>{@code /topic/greeks/{symbol}} — Options Greeks updates</li>
 * </ul>
 *
 * <p>No CORS, JWT, or HTTPS — pure loopback interface for sub-millisecond IPC.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Enable simple in-memory broker for /topic destinations
        config.enableSimpleBroker("/topic");

        // Prefix for messages from the UI to the server
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Main WebSocket endpoint — Electron connects here
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*"); // localhost only, no origin restrictions needed
    }
}
