package com.quantstation.web;

import com.quantstation.domain.Order;
import com.quantstation.domain.Position;
import com.quantstation.domain.Tick;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

/**
 * WebSocket controller for pushing real-time updates to the Electron UI.
 *
 * <p>STOMP topic destinations:
 * <ul>
 *   <li>{@code /topic/ticks/{symbol}} — Market tick updates</li>
 *   <li>{@code /topic/orders} — Order status changes</li>
 *   <li>{@code /topic/positions} — Position updates</li>
 *   <li>{@code /topic/pnl} — PnL snapshots</li>
 *   <li>{@code /topic/greeks/{symbol}} — Options Greeks</li>
 * </ul>
 *
 * <p>No authentication — pure loopback IPC for sub-millisecond delivery.
 */
@Controller
public class UiWebSocketController {

    private static final Logger log = LoggerFactory.getLogger(UiWebSocketController.class);

    private final SimpMessagingTemplate messagingTemplate;

    public UiWebSocketController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Push a market tick to the UI.
     */
    public void pushTick(Tick tick) {
        messagingTemplate.convertAndSend(
                "/topic/ticks/" + tick.symbol(), tick);
    }

    /**
     * Push an order status update to the UI.
     */
    public void pushOrderUpdate(Order order) {
        messagingTemplate.convertAndSend("/topic/orders", order);
        log.debug("UI push: order {} → {}", order.getOrderId(), order.getStatus());
    }

    /**
     * Push a position update to the UI.
     */
    public void pushPositionUpdate(Position position) {
        messagingTemplate.convertAndSend("/topic/positions", position);
    }

    /**
     * Push a PnL snapshot to the UI.
     */
    public void pushPnlUpdate(double unrealizedPnl, double realizedPnl, double totalPnl) {
        var pnlData = java.util.Map.of(
                "unrealizedPnl", unrealizedPnl,
                "realizedPnl", realizedPnl,
                "totalPnl", totalPnl,
                "timestamp", java.time.Instant.now().toString()
        );
        messagingTemplate.convertAndSend("/topic/pnl", pnlData);
    }
}
