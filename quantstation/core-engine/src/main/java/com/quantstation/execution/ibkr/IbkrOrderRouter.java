package com.quantstation.execution.ibkr;

import com.quantstation.domain.Order;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Translates QuantStation Order objects into IB API calls.
 *
 * <p>Responsible for:
 * <ul>
 *   <li>Converting Order → IB Contract + IB Order</li>
 *   <li>Submitting orders via EClientSocket</li>
 *   <li>Handling cancel requests</li>
 * </ul>
 *
 * <p>This operates on the <strong>hot trading path</strong> and should avoid
 * unnecessary allocations or blocking operations.
 */
@Component
public class IbkrOrderRouter {

    private static final Logger log = LoggerFactory.getLogger(IbkrOrderRouter.class);

    private final IbkrConnectionManager connectionManager;

    public IbkrOrderRouter(IbkrConnectionManager connectionManager) {
        this.connectionManager = connectionManager;
    }

    /**
     * Route an order to IB Gateway.
     *
     * @param order The order to submit
     * @throws IllegalStateException if not connected to IB Gateway
     */
    public void routeOrder(Order order) {
        if (!connectionManager.isConnected()) {
            log.warn("IbkrOrderRouter: Not connected to IB Gateway — queuing order");
            // In production, this would queue and retry
            order.markSubmitted(connectionManager.getNextOrderId());
            return;
        }

        int ibOrderId = connectionManager.getNextOrderId();
        order.markSubmitted(ibOrderId);

        log.info("IbkrOrderRouter: Routing order {} → IB orderId {}",
                order.getOrderId(), ibOrderId);

        // TODO: Implement with TWS API:
        // Contract contract = buildContract(order);
        // com.ib.client.Order ibOrder = buildIbOrder(order);
        // client.placeOrder(ibOrderId, contract, ibOrder);
    }

    /**
     * Cancel an order via IB Gateway.
     */
    public void cancelOrder(Order order) {
        if (!connectionManager.isConnected()) {
            log.warn("IbkrOrderRouter: Not connected — cannot cancel order {}",
                    order.getOrderId());
            return;
        }

        log.info("IbkrOrderRouter: Cancelling order {} (IB orderId {})",
                order.getOrderId(), order.getIbkrOrderId());

        // TODO: client.cancelOrder(order.getIbkrOrderId(), "");
    }

    // ── Contract/Order Builders (TODO: implement with TWS API) ──

    // private Contract buildContract(Order order) {
    //     Contract contract = new Contract();
    //     contract.symbol(order.getSymbol());
    //     contract.secType("STK");
    //     contract.exchange("SMART");
    //     contract.currency("USD");
    //     return contract;
    // }

    // private com.ib.client.Order buildIbOrder(Order order) {
    //     com.ib.client.Order ibOrder = new com.ib.client.Order();
    //     ibOrder.action(order.getSide() == Order.Side.BUY ? "BUY" : "SELL");
    //     ibOrder.totalQuantity(Decimal.get(order.getQuantity()));
    //     ibOrder.orderType(mapOrderType(order.getOrderType()));
    //     if (order.getLimitPrice() > 0) ibOrder.lmtPrice(order.getLimitPrice());
    //     if (order.getStopPrice() > 0) ibOrder.auxPrice(order.getStopPrice());
    //     return ibOrder;
    // }
}
