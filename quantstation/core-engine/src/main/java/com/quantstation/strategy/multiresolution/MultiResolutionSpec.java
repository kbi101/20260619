package com.quantstation.strategy.multiresolution;

/**
 * Strategy Execution Parameters for a symbol at a specific timeframe.
 */
public record MultiResolutionSpec(
        String symbol,
        String timeframe,
        double takeProfitZscore,
        double stopLossZscore,
        Double maxRsiThreshold,
        Double maxAdxThreshold,
        boolean requireMacdBullish,
        boolean useHmmFilter
) {
    public static MultiResolutionSpec defaultSpec(String symbol, String timeframe) {
        return new MultiResolutionSpec(
                symbol,
                timeframe,
                1.5,   // takeProfitZscore
                1.0,   // stopLossZscore
                70.0,  // maxRsiThreshold
                40.0,  // maxAdxThreshold
                false, // requireMacdBullish
                true   // useHmmFilter
        );
    }
}
