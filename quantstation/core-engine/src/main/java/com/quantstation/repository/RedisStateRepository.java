package com.quantstation.repository;

import com.quantstation.domain.Order;
import com.quantstation.domain.OptionGreeks;
import com.quantstation.domain.Position;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Redis-backed state repository for instantaneous lookups.
 *
 * <p>Key structure:
 * <pre>
 * qs:price:{symbol}         → last price (String)
 * qs:position:{symbol}      → Position (JSON hash)
 * qs:order:{orderId}        → Order (JSON hash)
 * qs:greeks:{contractSymbol} → OptionGreeks (JSON hash)
 * qs:pnl:total              → Total PnL (String)
 * </pre>
 */
@Repository
public class RedisStateRepository {

    private static final Logger log = LoggerFactory.getLogger(RedisStateRepository.class);

    private static final String PREFIX = "qs:";
    private static final String PRICE_KEY = PREFIX + "price:";
    private static final String POSITION_KEY = PREFIX + "position:";
    private static final String ORDER_KEY = PREFIX + "order:";
    private static final String GREEKS_KEY = PREFIX + "greeks:";
    private static final String PNL_KEY = PREFIX + "pnl:total";

    private final RedisTemplate<String, Object> redisTemplate;

    public RedisStateRepository(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    // ── Price State ─────────────────────────────────

    public void updateLastPrice(String symbol, double price) {
        redisTemplate.opsForValue().set(PRICE_KEY + symbol, price);
    }

    public Double getLastPrice(String symbol) {
        Object val = redisTemplate.opsForValue().get(PRICE_KEY + symbol);
        return val != null ? ((Number) val).doubleValue() : null;
    }

    // ── Position State ──────────────────────────────

    public void savePosition(Position position) {
        redisTemplate.opsForValue().set(
                POSITION_KEY + position.getSymbol(), position);
    }

    public Position getPosition(String symbol) {
        Object val = redisTemplate.opsForValue().get(POSITION_KEY + symbol);
        return val instanceof Position p ? p : null;
    }

    // ── Order State ─────────────────────────────────

    public void saveOrder(Order order) {
        redisTemplate.opsForValue().set(
                ORDER_KEY + order.getOrderId(), order);
    }

    public Order getOrder(String orderId) {
        Object val = redisTemplate.opsForValue().get(ORDER_KEY + orderId);
        return val instanceof Order o ? o : null;
    }

    // ── Greeks State ────────────────────────────────

    public void saveGreeks(OptionGreeks greeks) {
        redisTemplate.opsForValue().set(
                GREEKS_KEY + greeks.contractSymbol(), greeks);
    }

    public OptionGreeks getGreeks(String contractSymbol) {
        Object val = redisTemplate.opsForValue().get(GREEKS_KEY + contractSymbol);
        return val instanceof OptionGreeks g ? g : null;
    }

    // ── PnL State ───────────────────────────────────

    public void updateTotalPnl(double totalPnl) {
        redisTemplate.opsForValue().set(PNL_KEY, totalPnl);
    }

    public Double getTotalPnl() {
        Object val = redisTemplate.opsForValue().get(PNL_KEY);
        return val != null ? ((Number) val).doubleValue() : 0.0;
    }

    // ── Daily Notes State ───────────────────────────

    private static final String DAILY_NOTES_KEY = PREFIX + "notes:daily";

    public void saveDailyNotes(String notesJson) {
        redisTemplate.opsForValue().set(DAILY_NOTES_KEY, notesJson);
    }

    public String getDailyNotes() {
        Object val = redisTemplate.opsForValue().get(DAILY_NOTES_KEY);
        return val instanceof String s ? s : (val != null ? val.toString() : null);
    }

    // ── Utilities ───────────────────────────────────

    /**
     * Get all keys matching a pattern (for debugging).
     */
    public Set<String> getKeys(String pattern) {
        Set<String> keys = redisTemplate.keys(PREFIX + pattern);
        return keys != null ? keys : Set.of();
    }
}
