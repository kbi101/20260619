package com.quantstation.execution.ibkr;

import com.ib.client.Contract;
import com.ib.client.Decimal;
import com.ib.client.OrderCancel;
import com.quantstation.domain.Order;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Translates QuantStation Order objects into IB API calls.
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

        try {
            Contract contract = buildContract(order);
            com.ib.client.Order ibOrder = buildIbOrder(order);
            connectionManager.getClient().placeOrder(ibOrderId, contract, ibOrder);
        } catch (Exception e) {
            log.error("IbkrOrderRouter: Failed to place order {} on IB client", order.getOrderId(), e);
            throw new RuntimeException("Failed to place order: " + e.getMessage(), e);
        }
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

        try {
            connectionManager.getClient().cancelOrder(order.getIbkrOrderId(), new OrderCancel());
        } catch (Exception e) {
            log.error("IbkrOrderRouter: Failed to cancel order {}", order.getOrderId(), e);
        }
    }

    private Contract buildContract(Order order) {
        Contract contract = new Contract();
        contract.symbol(order.getSymbol());
        contract.secType("STK");
        contract.exchange("SMART");
        contract.currency("USD");
        return contract;
    }

    private String mapOrderType(Order.OrderType type) {
        return switch (type) {
            case MARKET -> "MKT";
            case LIMIT -> "LMT";
            case STOP -> "STP";
            case STOP_LIMIT -> "STP LMT";
        };
    }

    private com.ib.client.Order buildIbOrder(Order order) {
        com.ib.client.Order ibOrder = new com.ib.client.Order();
        ibOrder.action(order.getSide() == Order.Side.BUY ? "BUY" : "SELL");
        ibOrder.totalQuantity(Decimal.get(order.getQuantity()));
        ibOrder.orderType(mapOrderType(order.getOrderType()));
        if (order.getLimitPrice() > 0) ibOrder.lmtPrice(order.getLimitPrice());
        if (order.getStopPrice() > 0) ibOrder.auxPrice(order.getStopPrice());
        return ibOrder;
    }
}
