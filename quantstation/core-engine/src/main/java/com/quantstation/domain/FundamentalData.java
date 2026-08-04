package com.quantstation.domain;

/**
 * Immutable domain record for stock fundamental reference data & daily statistics.
 */
public record FundamentalData(
        String symbol,
        String companyName,
        String sector,
        String industry,
        long marketCap,
        long floatShares,
        double atr,
        double avgVolume,
        double beta,
        double shortFloatPercent
) {}
