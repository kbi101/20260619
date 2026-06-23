package com.quantstation.web;

import com.quantstation.marketdata.MarketDataProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;
import org.springframework.web.socket.messaging.SessionUnsubscribeEvent;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Listens to WebSocket STOMP subscription events to dynamically
 * manage active market data subscriptions with the provider.
 */
@Component
public class WebSocketSubscriptionListener {

    private static final Logger log = LoggerFactory.getLogger(WebSocketSubscriptionListener.class);
    
    private final MarketDataProvider marketDataProvider;
    private final Map<String, String> subscriptionIdToSymbol = new ConcurrentHashMap<>();
    private final Map<String, Integer> symbolRefCounts = new ConcurrentHashMap<>();

    public WebSocketSubscriptionListener(MarketDataProvider marketDataProvider) {
        this.marketDataProvider = marketDataProvider;
    }

    @EventListener
    public void handleSessionSubscribe(SessionSubscribeEvent event) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.wrap(event.getMessage());
        String destination = headers.getDestination();
        String subId = headers.getSubscriptionId();
        
        if (destination != null && destination.startsWith("/topic/ticks/")) {
            String symbol = destination.substring("/topic/ticks/".length());
            if (subId != null) {
                subscriptionIdToSymbol.put(subId, symbol);
            }
            int count = symbolRefCounts.merge(symbol, 1, Integer::sum);
            log.info("WebSocket: Client subscribed to {} (subId={}, refCount={})", symbol, subId, count);
            if (count == 1) {
                marketDataProvider.subscribe(symbol);
            }
        }
    }

    @EventListener
    public void handleSessionUnsubscribe(SessionUnsubscribeEvent event) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.wrap(event.getMessage());
        String subId = headers.getSubscriptionId();
        
        if (subId != null) {
            String symbol = subscriptionIdToSymbol.remove(subId);
            if (symbol != null) {
                Integer current = symbolRefCounts.compute(symbol, (k, v) -> (v == null || v <= 1) ? null : v - 1);
                int count = current != null ? current : 0;
                log.info("WebSocket: Client unsubscribed from {} (subId={}, refCount={})", symbol, subId, count);
                if (count == 0) {
                    marketDataProvider.unsubscribe(symbol);
                }
            }
        }
    }
}
