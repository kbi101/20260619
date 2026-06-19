package com.quantstation.execution.ibkr;

import com.quantstation.execution.OrderManagementSystem;
import com.quantstation.marketdata.TickRouter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * IB Gateway EWrapper callback handler.
 *
 * <p>Bridges the IB TWS API's callback-driven model to QuantStation's services.
 * All EWrapper callbacks are dispatched to the appropriate service:
 * <ul>
 *   <li>Order/fill callbacks → OrderManagementSystem</li>
 *   <li>Market data callbacks → TickRouter</li>
 *   <li>Connection callbacks → IbkrConnectionManager</li>
 * </ul>
 *
 * <p><strong>Implementation Note:</strong> This class will implement {@code EWrapper}
 * once the TWS API JARs are added to the build. For now, it defines the callback
 * routing pattern that will be wired up.
 */
@Component
public class IbkrCallbackHandler {
    // TODO: implements EWrapper

    private static final Logger log = LoggerFactory.getLogger(IbkrCallbackHandler.class);

    private final OrderManagementSystem oms;
    private final IbkrConnectionManager connectionManager;
    // Note: TickRouter injected lazily to avoid circular dependency
    private TickRouter tickRouter;

    public IbkrCallbackHandler(OrderManagementSystem oms,
                               IbkrConnectionManager connectionManager) {
        this.oms = oms;
        this.connectionManager = connectionManager;
    }

    public void setTickRouter(TickRouter tickRouter) {
        this.tickRouter = tickRouter;
    }

    // ── Connection Callbacks ─────────────────────────

    // @Override
    public void nextValidId(int orderId) {
        log.info("IB Gateway: Next valid order ID = {}", orderId);
        connectionManager.setNextOrderId(orderId);
    }

    // @Override
    public void connectAck() {
        log.info("IB Gateway: Connection acknowledged");
    }

    // ── Order/Execution Callbacks ────────────────────

    // @Override
    public void orderStatus(int orderId, String status, double filled,
                            double remaining, double avgFillPrice,
                            int permId, int parentId, double lastFillPrice,
                            int clientId, String whyHeld, double mktCapPrice) {
        log.info("IB orderStatus: orderId={} status={} filled={} avg={}",
                orderId, status, filled, avgFillPrice);

        // Map IB orderId back to our order
        // TODO: implement orderId lookup map
        // oms.onOrderStatus(ourOrderId, status, whyHeld);
    }

    // @Override
    public void execDetails(int reqId /*, Contract contract, Execution execution */) {
        // TODO: Extract fill details and forward to OMS
        // oms.onFill(orderId, execution.shares(), execution.price());
    }

    // ── Market Data Callbacks ────────────────────────

    // @Override
    public void tickPrice(int tickerId, int field, double price /*, TickAttrib attribs */) {
        // TODO: Convert to Tick and forward to TickRouter
        // tickRouter.onTick(Tick.trade(symbol, price, 0, "", Instant.now()));
    }

    // @Override
    public void tickSize(int tickerId, int field, int size) {
        // TODO: Update tick with size information
    }

    // ── Error Handling ───────────────────────────────

    // @Override
    public void error(int id, int errorCode, String errorMsg, String advancedOrderRejectJson) {
        if (errorCode == 2104 || errorCode == 2106 || errorCode == 2158) {
            // Market data farm connection messages (informational)
            log.info("IB info: [{}] {}", errorCode, errorMsg);
        } else if (errorCode >= 2000) {
            log.warn("IB warning: [{}] {} (orderId={})", errorCode, errorMsg, id);
        } else {
            log.error("IB error: [{}] {} (orderId={})", errorCode, errorMsg, id);
        }
    }

    // Note: All other EWrapper methods would be implemented as no-ops
    // until needed. There are ~80 methods in the EWrapper interface.
}
