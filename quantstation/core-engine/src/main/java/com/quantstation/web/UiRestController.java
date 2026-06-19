package com.quantstation.web;

import com.quantstation.domain.Order;
import com.quantstation.execution.OrderManagementSystem;
import com.quantstation.marketdata.TickRouter;
import com.quantstation.repository.QuestDbTickWriter;
import com.quantstation.repository.RedisStateRepository;
import com.quantstation.strategy.StrategyEngine;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST controller for non-streaming UI operations.
 *
 * <p>Provides endpoints for:
 * <ul>
 *   <li>Order submission and cancellation</li>
 *   <li>Position and state queries</li>
 *   <li>System health and monitoring</li>
 * </ul>
 */
@CrossOrigin
@RestController
@RequestMapping("/api")
public class UiRestController {

    private final OrderManagementSystem oms;
    private final StrategyEngine strategyEngine;
    private final RedisStateRepository redisState;
    private final QuestDbTickWriter questDbWriter;

    public UiRestController(OrderManagementSystem oms,
                            StrategyEngine strategyEngine,
                            RedisStateRepository redisState,
                            QuestDbTickWriter questDbWriter) {
        this.oms = oms;
        this.strategyEngine = strategyEngine;
        this.redisState = redisState;
        this.questDbWriter = questDbWriter;
    }

    // ── Orders ──────────────────────────────────────

    @PostMapping("/orders")
    public ResponseEntity<Order> submitOrder(@RequestBody OrderRequest request) {
        Order order = new Order(
                request.symbol(),
                Order.Side.valueOf(request.side().toUpperCase()),
                Order.OrderType.valueOf(request.orderType().toUpperCase()),
                request.quantity(),
                request.limitPrice(),
                request.stopPrice()
        );
        Order result = oms.submitOrder(order);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/orders/{orderId}")
    public ResponseEntity<Void> cancelOrder(@PathVariable String orderId) {
        oms.cancelOrder(orderId);
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/orders")
    public ResponseEntity<Map<String, Order>> getActiveOrders() {
        return ResponseEntity.ok(oms.getActiveOrders());
    }

    // ── Positions ───────────────────────────────────

    @GetMapping("/positions")
    public ResponseEntity<?> getPositions() {
        return ResponseEntity.ok(oms.getPositions());
    }

    // ── System Status ───────────────────────────────

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        return ResponseEntity.ok(Map.of(
                "activeOrders", oms.getActiveOrders().size(),
                "positions", oms.getPositions().size(),
                "activeStrategies", strategyEngine.getActiveCount(),
                "questdb", Map.of(
                        "written", questDbWriter.getTotalWritten(),
                        "dropped", questDbWriter.getTotalDropped(),
                        "buffered", questDbWriter.getBufferSize()
                )
        ));
    }

    // ── Daily Notes ──────────────────────────────────

    @GetMapping("/notes/daily")
    public ResponseEntity<String> getDailyNotes() {
        String notes = redisState.getDailyNotes();
        return ResponseEntity.ok(notes != null ? notes : "{}");
    }

    @PostMapping("/notes/daily")
    public ResponseEntity<Void> saveDailyNotes(@RequestBody String notesJson) {
        redisState.saveDailyNotes(notesJson);
        return ResponseEntity.ok().build();
    }

    // ── Request DTOs ────────────────────────────────

    public record OrderRequest(
            String symbol,
            String side,
            String orderType,
            double quantity,
            double limitPrice,
            double stopPrice
    ) {}
}
