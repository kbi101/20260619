package com.quantstation.domain;

import java.time.Instant;

/**
 * Options Greeks for a single contract.
 *
 * <p>Stored in Redis for instant lookups and pushed to the UI for the Greeks Matrix.
 *
 * @param contractSymbol Full options contract symbol (e.g., "AAPL230120C00150000")
 * @param underlying     Underlying ticker symbol
 * @param strike         Strike price
 * @param expiry         Expiration date
 * @param callPut        "C" for call, "P" for put
 * @param delta          Rate of change of option price vs underlying price
 * @param gamma          Rate of change of delta vs underlying price
 * @param theta          Time decay per day
 * @param vega           Sensitivity to 1% change in implied volatility
 * @param rho            Sensitivity to 1% change in interest rates
 * @param iv             Implied volatility (annualized, decimal)
 * @param bid            Current bid price
 * @param ask            Current ask price
 * @param last           Last trade price
 * @param volume         Today's volume
 * @param openInterest   Open interest
 * @param timestamp      When these Greeks were last computed/received
 */
public record OptionGreeks(
        String contractSymbol,
        String underlying,
        double strike,
        Instant expiry,
        String callPut,
        double delta,
        double gamma,
        double theta,
        double vega,
        double rho,
        double iv,
        double bid,
        double ask,
        double last,
        int volume,
        int openInterest,
        Instant timestamp
) {
    /**
     * Returns the mid-price of the option.
     */
    public double midPrice() {
        return (bid + ask) / 2.0;
    }

    /**
     * Returns the extrinsic (time) value.
     *
     * @param underlyingPrice Current price of the underlying
     */
    public double extrinsicValue(double underlyingPrice) {
        double intrinsic = "C".equals(callPut)
                ? Math.max(0, underlyingPrice - strike)
                : Math.max(0, strike - underlyingPrice);
        return midPrice() - intrinsic;
    }

    /**
     * Returns true if the option is in-the-money.
     */
    public boolean isItm(double underlyingPrice) {
        return "C".equals(callPut)
                ? underlyingPrice > strike
                : underlyingPrice < strike;
    }
}
