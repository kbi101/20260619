package com.quantstation.strategy.multiresolution;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Registry holding symbol-tuned Target Policy Specifications ported from QuantTune target_rules.ttl.
 */
public class MultiResolutionSpecRegistry {

    private static final Map<String, MultiResolutionSpec> REGISTRY = new ConcurrentHashMap<>();
    private static final Set<String> STAPLES_SYMBOLS = Set.of("WMT", "KO", "KMB", "TGT", "PG", "COST", "PEP");

    static {
        initSpecs();
    }

    private static void register(String symbol, String timeframe, double tpZ, double slZ, Double maxRsi, Double maxAdx, boolean requireMacdBullish, boolean useHmmFilter) {
        String sym = symbol.toUpperCase();
        String tf = timeframe.toLowerCase();
        String key = sym + ":" + tf;
        REGISTRY.put(key, new MultiResolutionSpec(sym, tf, tpZ, slZ, maxRsi, maxAdx, requireMacdBullish, useHmmFilter));
    }

    public static int loadFromTtlContent(String ttlContent) {
        if (ttlContent == null || ttlContent.isBlank()) return 0;
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(":([A-Za-z0-9_]+)\\s+a\\s+:TargetPolicy\\s*;(.*?)(?=\\.\\s|\\n\\n)", java.util.regex.Pattern.DOTALL);
        java.util.regex.Matcher matcher = pattern.matcher(ttlContent);
        int count = 0;

        while (matcher.find()) {
            String name = matcher.group(1);
            String body = matcher.group(2);

            String[] parts = name.split("_");
            if (parts.length < 3) continue;

            String sym = parts[1].toUpperCase();
            String tf = parts[2].toLowerCase();

            double tp = parseDouble(body, ":takeProfitZScore", 1.5);
            double sl = parseDouble(body, ":stopLossZScore", 1.0);
            Double rsi = parseDoubleNullable(body, ":maxRsiThreshold");
            Double adx = parseDoubleNullable(body, ":maxAdxThreshold");
            boolean macd = parseBoolean(body, ":requireMacdBullish");
            boolean hmm = parseBoolean(body, ":useHmmFilter");

            register(sym, tf, tp, sl, rsi, adx, macd, hmm);
            count++;
        }
        return count;
    }

    private static double parseDouble(String text, String key, double defaultVal) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile(key + "\\s+([\\d\\.]+)").matcher(text);
        return m.find() ? Double.parseDouble(m.group(1)) : defaultVal;
    }

    private static Double parseDoubleNullable(String text, String key) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile(key + "\\s+([\\d\\.]+)").matcher(text);
        return m.find() ? Double.parseDouble(m.group(1)) : null;
    }

    private static boolean parseBoolean(String text, String key) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile(key + "\\s+(true|false)").matcher(text);
        return m.find() && "true".equalsIgnoreCase(m.group(1));
    }

    public static MultiResolutionSpec getSpec(String symbol, String timeframe) {
        if (symbol == null || timeframe == null) return MultiResolutionSpec.defaultSpec(symbol, timeframe);
        String sym = symbol.toUpperCase();
        String tf = timeframe.toLowerCase();

        String key = sym + ":" + tf;
        MultiResolutionSpec spec = REGISTRY.get(key);
        if (spec != null) return spec;

        // Fallback for Consumer Staples sector constituents
        if (STAPLES_SYMBOLS.contains(sym)) {
            MultiResolutionSpec fallback = REGISTRY.get("XLP:" + tf);
            if (fallback != null) {
                return new MultiResolutionSpec(sym, tf, fallback.takeProfitZscore(), fallback.stopLossZscore(), fallback.maxRsiThreshold(), fallback.maxAdxThreshold(), fallback.requireMacdBullish(), fallback.useHmmFilter());
            }
        }

        return MultiResolutionSpec.defaultSpec(sym, tf);
    }

    private static void initSpecs() {
register("SPY", "15m", 1.1, 0.8, 32.5, null, false, true);
register("QQQ", "15m", 0.8, 0.5, null, null, false, false);
register("IWM", "15m", 1.0, 1.8, null, null, false, true);
register("XLK", "15m", 2.2, 0.7, null, 17.5, false, false);
register("XLF", "15m", 1.4, 0.5, 40.0, null, false, false);
register("XLV", "15m", 1.0, 1.8, null, null, false, false);
register("XLY", "15m", 2.0, 1.1, null, null, false, false);
register("XLP", "15m", 2.3, 0.9, null, 30.0, false, true);
register("XLE", "15m", 2.0, 0.7, 30.0, null, false, false);
register("XLI", "15m", 1.1, 0.8, null, null, false, false);
register("XLB", "15m", 1.1, 1.1, null, null, true, true);
register("XLU", "15m", 0.8, 2.3, 40.0, 27.5, false, true);
register("XLRE", "15m", 1.4, 0.6, 42.5, 22.5, false, false);
register("XLC", "15m", 1.1, 0.7, null, 30.0, true, false);
register("SPY", "5m", 2.6, 0.7, 30.0, null, false, false);
register("QQQ", "5m", 1.2, 0.9, null, null, true, false);
register("IWM", "5m", 1.1, 1.8, null, null, false, true);
register("XLK", "5m", 1.2, 0.8, 37.5, null, false, true);
register("XLF", "5m", 1.1, 0.9, 40.0, null, false, false);
register("XLV", "5m", 1.6, 0.5, null, 35.0, false, false);
register("XLY", "5m", 1.9, 1.1, null, 15.0, false, true);
register("XLP", "5m", 1.8, 2.0, 40.0, null, true, false);
register("XLE", "5m", 1.5, 0.9, null, null, false, true);
register("XLI", "5m", 1.5, 1.1, 45.0, null, false, true);
register("XLB", "5m", 1.2, 2.1, 35.0, null, true, true);
register("XLU", "5m", 1.8, 0.9, null, null, true, false);
register("XLRE", "5m", 1.5, 1.0, null, null, false, false);
register("XLC", "5m", 0.8, 1.3, null, 15.0, false, false);
register("WMT", "5m", 1.2, 2.3, 45.0, null, true, true);
register("KO", "5m", 0.8, 1.9, null, null, true, true);
register("KMB", "5m", 1.8, 0.5, null, null, false, true);
register("TGT", "5m", 1.6, 0.5, 40.0, null, false, false);
register("PG", "5m", 1.2, 0.7, 40.0, null, true, false);
register("COST", "5m", 1.9, 1.4, 35.0, null, false, true);
register("PEP", "5m", 1.4, 1.8, null, 22.5, false, true);
register("SPY", "1h", 1.3, 0.5, null, null, false, false);
register("QQQ", "1h", 1.1, 1.2, 35.0, null, false, false);
register("IWM", "1h", 1.1, 1.1, null, null, false, false);
register("XLK", "1h", 1.3, 0.9, null, null, false, false);
register("XLF", "1h", 0.9, 1.5, null, null, false, false);
register("XLV", "1h", 1.3, 1.6, null, null, false, true);
register("XLY", "1h", 0.8, 0.8, null, null, false, false);
register("XLP", "1h", 1.5, 0.6, null, 35.0, false, false);
register("XLE", "1h", 1.5, 1.0, null, null, false, false);
register("XLI", "1h", 1.2, 0.6, 37.5, null, false, true);
register("XLB", "1h", 1.6, 0.7, 30.0, null, false, true);
register("XLU", "1h", 0.8, 1.5, null, 30.0, false, true);
register("XLRE", "1h", 0.8, 0.9, null, null, false, false);
register("XLC", "1h", 0.8, 0.8, 42.5, 25.0, false, false);
register("WMT", "1h", 1.0, 0.8, 30.0, null, false, false);
register("KO", "1h", 2.1, 0.6, 35.0, null, false, false);
register("KMB", "1h", 1.2, 0.8, null, null, false, false);
register("TGT", "1h", 1.7, 1.3, null, null, false, false);
register("PG", "1h", 1.3, 0.7, 40.0, null, false, false);
register("COST", "1h", 1.0, 0.7, 32.5, null, false, true);
register("PEP", "1h", 0.8, 1.7, null, null, true, false);
register("SPY", "4h", 1.1, 0.7, null, 25.0, false, false);
register("QQQ", "4h", 1.0, 1.0, null, 35.0, false, false);
register("IWM", "4h", 1.5, 1.0, null, null, false, false);
register("XLK", "4h", 1.5, 1.0, null, null, false, false);
register("XLF", "4h", 1.5, 1.0, null, null, false, false);
register("XLV", "4h", 1.1, 1.0, null, null, false, false);
register("XLY", "4h", 0.8, 1.2, null, null, false, false);
register("XLP", "4h", 0.8, 1.0, 42.5, null, false, false);
register("XLE", "4h", 0.9, 2.0, null, null, false, false);
register("XLI", "4h", 1.5, 1.0, null, null, false, false);
register("XLB", "4h", 1.0, 0.8, null, null, false, false);
register("XLU", "4h", 1.5, 1.0, null, null, false, false);
register("XLRE", "4h", 1.5, 1.0, null, null, false, false);
register("XLC", "4h", 1.7, 0.5, null, null, false, false);
register("WMT", "4h", 1.4, 0.5, null, null, false, false);
register("KO", "4h", 1.5, 1.0, null, null, false, false);
register("KMB", "4h", 0.9, 1.4, null, null, false, false);
register("TGT", "4h", 0.8, 0.8, 45.0, null, false, false);
register("PG", "4h", 1.1, 0.9, null, null, false, false);
register("COST", "4h", 1.5, 1.0, null, null, false, false);
register("PEP", "4h", 1.0, 0.7, 37.5, null, false, false);
register("SPY", "2m", 1.7, 1.2, null, null, false, true);
register("QQQ", "2m", 1.1, 1.3, 45.0, null, false, true);
register("IWM", "2m", 1.7, 1.3, 40.0, null, true, true);
register("XLK", "2m", 1.4, 1.1, null, 17.5, false, true);
register("XLF", "2m", 1.3, 2.1, 37.5, 30.0, false, false);
register("XLV", "2m", 1.0, 1.6, 45.0, 20.0, false, false);
register("XLY", "2m", 0.8, 1.2, null, null, true, true);
register("XLP", "2m", 2.8, 0.5, 45.0, 35.0, false, true);
register("XLE", "2m", 1.9, 1.4, 45.0, null, true, true);
register("XLI", "2m", 1.6, 1.4, null, 32.5, true, false);
register("XLB", "2m", 0.9, 2.3, 27.5, null, true, false);
register("XLU", "2m", 1.3, 1.7, 40.0, 20.0, false, true);
register("XLRE", "2m", 1.4, 0.9, null, null, false, false);
register("XLC", "2m", 1.1, 1.5, null, 15.0, false, true);
register("WMT", "2m", 1.5, 1.0, null, null, false, false);
register("KO", "2m", 1.3, 1.6, null, null, true, true);
register("KMB", "2m", 2.4, 1.4, 25.0, null, false, false);
register("TGT", "2m", 1.4, 1.3, 32.5, null, true, true);
register("PG", "2m", 1.5, 2.0, null, null, true, true);
register("COST", "2m", 1.2, 0.7, null, 35.0, false, true);
register("PEP", "2m", 0.8, 1.0, null, 27.5, false, false);
register("SPY", "30m", 0.8, 0.5, 45.0, 22.5, false, false);
register("QQQ", "30m", 1.1, 0.7, 37.5, null, false, false);
register("IWM", "30m", 1.5, 1.0, null, null, false, false);
register("XLK", "30m", 1.2, 1.3, 30.0, null, false, false);
register("XLF", "30m", 1.5, 1.0, null, null, false, false);
register("XLV", "30m", 1.4, 1.5, null, null, false, false);
register("XLY", "30m", 1.7, 0.6, 25.0, null, false, false);
register("XLP", "30m", 1.2, 1.1, null, null, false, false);
register("XLE", "30m", 0.8, 0.5, null, null, true, false);
register("XLI", "30m", 1.7, 1.1, null, null, false, true);
register("XLB", "30m", 1.5, 1.0, null, null, false, false);
register("XLU", "30m", 0.8, 0.9, null, null, false, false);
register("XLRE", "30m", 1.3, 1.4, null, 35.0, false, true);
register("XLC", "30m", 0.9, 1.4, null, null, false, false);
register("WMT", "30m", 1.4, 0.6, null, null, false, false);
register("KO", "30m", 0.9, 1.2, null, 27.5, false, true);
register("KMB", "30m", 1.5, 0.9, null, null, false, false);
register("TGT", "30m", 1.5, 0.5, null, null, false, false);
register("PG", "30m", 1.1, 1.1, null, null, false, false);
register("COST", "30m", 1.2, 1.5, null, null, false, false);
register("PEP", "30m", 0.9, 0.6, null, null, true, true);
    }
}
