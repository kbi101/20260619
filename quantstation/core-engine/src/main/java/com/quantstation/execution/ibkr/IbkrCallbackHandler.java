package com.quantstation.execution.ibkr;

import com.ib.client.*;
import com.quantstation.domain.Tick;
import com.quantstation.domain.Order;
import com.quantstation.domain.Position;
import com.quantstation.domain.BarData;
import com.quantstation.execution.OrderManagementSystem;
import com.quantstation.marketdata.TickRouter;
import com.quantstation.marketdata.ibkr.IbkrMarketDataAdapter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CompletableFuture;

/**
 * IB Gateway EWrapper callback handler.
 *
 * <p>Bridges the IB TWS API's callback-driven model to QuantStation's services.
 * All EWrapper callbacks are dispatched to the appropriate service.
 */
@Component
public class IbkrCallbackHandler extends DefaultEWrapper {

    private static final Logger log = LoggerFactory.getLogger(IbkrCallbackHandler.class);

    private final OrderManagementSystem oms;
    private final IbkrConnectionManager connectionManager;
    private final IbkrMarketDataAdapter marketDataAdapter;
    private final TickRouter tickRouter;

    private final Map<String, Tick> lastTicks = new ConcurrentHashMap<>();
    private final Map<Integer, List<BarData>> pendingBars = new ConcurrentHashMap<>();
    private final Map<Integer, CompletableFuture<List<BarData>>> pendingBarFutures = new ConcurrentHashMap<>();
    private final Map<Integer, String> pendingTimeframes = new ConcurrentHashMap<>();

    public IbkrCallbackHandler(OrderManagementSystem oms,
                               IbkrConnectionManager connectionManager,
                               @Lazy IbkrMarketDataAdapter marketDataAdapter,
                               TickRouter tickRouter) {
        this.oms = oms;
        this.connectionManager = connectionManager;
        this.marketDataAdapter = marketDataAdapter;
        this.tickRouter = tickRouter;
    }

    public void registerHistoricalFuture(int reqId, String timeframe, CompletableFuture<List<BarData>> future) {
        pendingBarFutures.put(reqId, future);
        pendingBars.put(reqId, new ArrayList<>());
        pendingTimeframes.put(reqId, timeframe);
    }

    // ── Connection Callbacks ─────────────────────────

    @Override
    public void nextValidId(int orderId) {
        log.info("IB Gateway: Next valid order ID = {}", orderId);
        connectionManager.setNextOrderId(orderId);
    }

    // ── Order/Execution Callbacks ────────────────────

    @Override
    public void orderStatus(int orderId, String status, Decimal filled,
                            Decimal remaining, double avgFillPrice,
                            long permId, int parentId, double lastFillPrice,
                            int clientId, String whyHeld, double mktCapPrice) {
        log.info("IB orderStatus: orderId={} status={} filled={} avg={}",
                orderId, status, filled, avgFillPrice);

        oms.getOrderByIbkrId(orderId).ifPresent(order -> {
            oms.onOrderStatus(order.getOrderId(), status, whyHeld);
        });
    }

    @Override
    public void execDetails(int reqId, Contract contract, Execution execution) {
        log.info("IB execDetails: reqId={} symbol={} shares={} price={}",
                reqId, contract.symbol(), execution.shares(), execution.price());
        
        oms.getOrderByIbkrId(execution.orderId()).ifPresent(order -> {
            oms.onFill(order.getOrderId(), execution.shares().value().doubleValue(), execution.price());
        });
    }

    // ── Market Data Callbacks ────────────────────────

    @Override
    public void tickPrice(int tickerId, int field, double price, TickAttrib attribs) {
        String symbol = marketDataAdapter.getSymbolForReqId(tickerId);
        if (symbol == null) return;

        // Map delayed fields (66: BID, 67: ASK, 68: LAST, 75: CLOSE) to standard fields (1, 2, 4, 9)
        int effectiveField = field;
        if (field == 66) effectiveField = 1;
        else if (field == 67) effectiveField = 2;
        else if (field == 68) effectiveField = 4;
        else if (field == 75) effectiveField = 9;

        Tick last = lastTicks.get(symbol);
        Tick updated;

        double bid = (last == null) ? 0.0 : last.bidPrice();
        double ask = (last == null) ? 0.0 : last.askPrice();
        double lastPrice = (last == null) ? 0.0 : last.price();
        double prevClose = (last == null) ? 0.0 : last.prevClose();
        int size = (last == null) ? 0 : last.size();
        int bidSize = (last == null) ? 0 : last.bidSize();
        int askSize = (last == null) ? 0 : last.askSize();
        String exchange = (last == null) ? null : last.exchange();
        String conditions = (last == null) ? null : last.conditions();

        if (effectiveField == 1) {
            bid = price;
        } else if (effectiveField == 2) {
            ask = price;
        } else if (effectiveField == 4) {
            lastPrice = price;
        } else if (effectiveField == 9) {
            prevClose = price;
        }

        // Fall back to mid/bid/ask price if last trade price is unavailable/0.0
        double finalPrice = lastPrice;
        if (finalPrice <= 0.0) {
            if (bid > 0.0 && ask > 0.0) {
                finalPrice = (bid + ask) / 2.0;
            } else if (bid > 0.0) {
                finalPrice = bid;
            } else if (ask > 0.0) {
                finalPrice = ask;
            }
        }

        updated = new Tick(symbol, finalPrice, size, exchange, conditions,
                bid, ask, bidSize, askSize, prevClose, Instant.now());

        lastTicks.put(symbol, updated);
        if (tickRouter != null) {
            tickRouter.onTick(updated);
        }
    }

    @Override
    public void tickSize(int tickerId, int field, Decimal size) {
        String symbol = marketDataAdapter.getSymbolForReqId(tickerId);
        if (symbol == null) return;

        // Map delayed fields (69: BID_SIZE, 70: ASK_SIZE, 71: LAST_SIZE) to standard fields (0, 3, 5)
        int effectiveField = field;
        if (field == 69) effectiveField = 0;
        else if (field == 70) effectiveField = 3;
        else if (field == 71) effectiveField = 5;

        Tick last = lastTicks.get(symbol);
        if (last == null) return;

        Tick updated;
        int sizeVal = size.value().intValue();

        if (effectiveField == 0) { // BID_SIZE
            updated = new Tick(symbol, last.price(), last.size(), last.exchange(), last.conditions(),
                    last.bidPrice(), last.askPrice(), sizeVal, last.askSize(), last.prevClose(), Instant.now());
        } else if (effectiveField == 3) { // ASK_SIZE
            updated = new Tick(symbol, last.price(), last.size(), last.exchange(), last.conditions(),
                    last.bidPrice(), last.askPrice(), last.bidSize(), sizeVal, last.prevClose(), Instant.now());
        } else if (effectiveField == 5) { // LAST_SIZE
            updated = new Tick(symbol, last.price(), sizeVal, last.exchange(), last.conditions(),
                    last.bidPrice(), last.askPrice(), last.bidSize(), last.askSize(), last.prevClose(), Instant.now());
        } else {
            return;
        }

        lastTicks.put(symbol, updated);
        if (tickRouter != null) {
            tickRouter.onTick(updated);
        }
    }

    // ── Historical Data Callbacks ────────────────────

    @Override
    public void historicalData(int reqId, Bar bar) {
        List<BarData> list = pendingBars.get(reqId);
        if (list != null) {
            String symbol = marketDataAdapter.getSymbolForReqId(reqId);
            String finalSymbol = symbol != null ? symbol : "UNKNOWN";
            String timeframe = pendingTimeframes.getOrDefault(reqId, "1m");

            Instant barStart;
            try {
                if (bar.time().matches("^\\d+$")) {
                    barStart = Instant.ofEpochSecond(Long.parseLong(bar.time()));
                } else {
                    String clean = bar.time().replaceAll("[^0-9]", "");
                    if (clean.length() >= 14) {
                        int y = Integer.parseInt(clean.substring(0, 4));
                        int m = Integer.parseInt(clean.substring(4, 6));
                        int d = Integer.parseInt(clean.substring(6, 8));
                        int hh = Integer.parseInt(clean.substring(8, 10));
                        int mm = Integer.parseInt(clean.substring(10, 12));
                        int ss = Integer.parseInt(clean.substring(12, 14));
                        java.time.ZonedDateTime zdt = java.time.ZonedDateTime.of(y, m, d, hh, mm, ss, 0, java.time.ZoneId.systemDefault());
                        barStart = zdt.toInstant();
                    } else if (clean.length() == 8) {
                        int y = Integer.parseInt(clean.substring(0, 4));
                        int m = Integer.parseInt(clean.substring(4, 6));
                        int d = Integer.parseInt(clean.substring(6, 8));
                        java.time.ZonedDateTime zdt = java.time.ZonedDateTime.of(y, m, d, 0, 0, 0, 0, java.time.ZoneId.systemDefault());
                        barStart = zdt.toInstant();
                    } else {
                        barStart = Instant.now();
                    }
                }
            } catch (Exception e) {
                barStart = Instant.now();
            }

            BarData barData = new BarData(
                    finalSymbol,
                    timeframe,
                    bar.open(),
                    bar.high(),
                    bar.low(),
                    bar.close(),
                    bar.volume().value().longValue(),
                    bar.wap().value().doubleValue(),
                    bar.count(),
                    barStart,
                    barStart.plusSeconds(60), // basic aggregation assumption
                    Instant.now()
            );
            list.add(barData);
        }
    }

    @Override
    public void historicalDataEnd(int reqId, String startDateStr, String endDateStr) {
        log.info("IB historicalDataEnd: reqId={} count={}", reqId, 
                pendingBars.containsKey(reqId) ? pendingBars.get(reqId).size() : 0);
        
        CompletableFuture<List<BarData>> future = pendingBarFutures.remove(reqId);
        List<BarData> list = pendingBars.remove(reqId);
        pendingTimeframes.remove(reqId);
        
        if (future != null && list != null) {
            future.complete(list);
        }
    }

    // ── Error Handling ───────────────────────────────

    @Override
    public void error(Exception e) {
        log.error("IB connection exception:", e);
    }

    @Override
    public void error(String str) {
        log.warn("IB error message: {}", str);
    }

    @Override
    public void error(int id, long errorTime, int errorCode, String errorMsg, String advancedOrderRejectJson) {
        if (errorCode == 2104 || errorCode == 2106 || errorCode == 2158) {
            log.info("IB info: [{}] {}", errorCode, errorMsg);
        } else if (errorCode >= 2000) {
            log.warn("IB warning: [{}] {} (orderId={})", errorCode, errorMsg, id);
        } else {
            log.error("IB error: [{}] {} (orderId={})", errorCode, errorMsg, id);
        }
    }

    public Tick getLastTick(String symbol) {
        return lastTicks.get(symbol);
    }

    public Map<String, Tick> getLastTicks() {
        return Map.copyOf(lastTicks);
    }
}
