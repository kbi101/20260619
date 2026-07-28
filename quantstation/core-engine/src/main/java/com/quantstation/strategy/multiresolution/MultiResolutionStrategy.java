package com.quantstation.strategy.multiresolution;

import com.quantstation.domain.BarData;
import com.quantstation.domain.Tick;
import com.quantstation.strategy.Strategy;
import com.quantstation.strategy.signals.Signal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * QuantStation Multi-Resolution Strategy Engine.
 *
 * <p>Evaluates market data across 6 candle resolutions (2m, 5m, 15m, 30m, 1h, 4h).
 * Generates automated trading signals when multi-timeframe consensus triggers fire:
 * <ul>
 *   <li><b>BULLISH_CONSENSUS</b> (>=3 BUY timeframes): Triggers automated BUY order</li>
 *   <li><b>BEARISH_CONSENSUS</b> (>=2 SELL timeframes): Triggers automated SELL order</li>
 * </ul>
 */
@Component
public class MultiResolutionStrategy implements Strategy {

    private static final Logger log = LoggerFactory.getLogger(MultiResolutionStrategy.class);

    public static final List<String> TIMEFRAME_CODES = List.of("2m", "5m", "15m", "30m", "1h", "4h");
    public static final Set<String> DEFAULT_SYMBOLS = Set.of(
            "SPY", "QQQ", "IWM", "XLK", "XLF", "XLV", "XLY", "XLP", "XLE", "XLI", "XLB", "XLU", "XLRE", "XLC",
            "WMT", "KO", "KMB", "TGT", "PG", "COST", "PEP"
    );

    public record TimeframeSignalResult(
            String timeframe,
            String signal,    // "BUY", "FILTERED", "SELL", "HOLD", "NO_DATA"
            String badge,
            double lastPx,
            double zScore,
            double rsi,
            double adx,
            double macdHist,
            String regimeLabel,
            String details
    ) {}

    public record SymbolConsensusResult(
            String symbol,
            double lastPx,
            String consensusCode,
            String consensusBadge,
            Map<String, TimeframeSignalResult> signals,
            Instant evaluatedAt
    ) {}

    private final Set<String> subscribedSymbols = new HashSet<>(DEFAULT_SYMBOLS);
    private final Map<String, List<BarData>> barBuffers = new ConcurrentHashMap<>();
    private final Map<String, SymbolConsensusResult> latestConsensus = new ConcurrentHashMap<>();
    private final Map<String, Long> lastSignalEmittedTimeMs = new ConcurrentHashMap<>();

    private boolean active = true;

    @Override
    public String getName() {
        return "MultiResolutionStrategy";
    }

    @Override
    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    @Override
    public Set<String> getSubscribedSymbols() {
        return Collections.unmodifiableSet(subscribedSymbols);
    }

    public void addSubscribedSymbol(String symbol) {
        subscribedSymbols.add(symbol.toUpperCase());
    }

    @Override
    public Signal onTick(Tick tick) {
        // Ticks are passed to onBar via bar builder / TickRouter. No direct hot-path signal on tick.
        return null;
    }

    @Override
    public Signal onBar(BarData bar) {
        if (!active || bar == null) return null;

        String symbol = bar.symbol().toUpperCase();
        List<BarData> buffer = barBuffers.computeIfAbsent(symbol, k -> new ArrayList<>());

        synchronized (buffer) {
            buffer.add(bar);
            if (buffer.size() > 2000) {
                buffer.subList(0, buffer.size() - 1500).clear();
            }
        }

        return evaluateSymbolConsensusAndSignal(symbol);
    }

    /**
     * Programmatic / Manual evaluation for a symbol using buffer data.
     */
    public SymbolConsensusResult evaluateSymbol(String symbol) {
        String sym = symbol.toUpperCase();
        List<BarData> bars;
        List<BarData> buffer = barBuffers.get(sym);
        if (buffer == null) return null;

        synchronized (buffer) {
            bars = new ArrayList<>(buffer);
        }
        if (bars.isEmpty()) return null;

        Map<String, TimeframeSignalResult> tfSignals = new LinkedHashMap<>();

        for (String tfCode : TIMEFRAME_CODES) {
            List<BarData> resampled = TimeframeResampler.resample(bars, tfCode);
            MultiResolutionSpec spec = MultiResolutionSpecRegistry.getSpec(sym, tfCode);
            TimeframeSignalResult sig = evaluateTimeframeSignal(resampled, spec, tfCode);
            tfSignals.put(tfCode, sig);
        }

        double lastPx = bars.get(bars.size() - 1).close();
        ConsensusEvaluation consensus = deriveConsensus(tfSignals);

        SymbolConsensusResult result = new SymbolConsensusResult(
                sym,
                lastPx,
                consensus.code(),
                consensus.badge(),
                tfSignals,
                Instant.now()
        );

        latestConsensus.put(sym, result);
        return result;
    }

    private Signal evaluateSymbolConsensusAndSignal(String symbol) {
        SymbolConsensusResult result = evaluateSymbol(symbol);
        if (result == null) return null;

        // Rate limit automated signals per symbol to avoid spamming (e.g. max once per 60 seconds)
        long now = System.currentTimeMillis();
        Long lastTime = lastSignalEmittedTimeMs.get(symbol);
        if (lastTime != null && (now - lastTime) < 60_000) {
            return null;
        }

        String code = result.consensusCode();
        if ("BULLISH_CONSENSUS".equals(code)) {
            lastSignalEmittedTimeMs.put(symbol, now);
            log.info("🚀 MultiResolutionStrategy: Triggering Automated BUY for {} @ ${}", symbol, result.lastPx());
            return Signal.limitBuy(
                    getName(),
                    symbol,
                    100.0, // Default position sizing
                    result.lastPx(),
                    "Multi-Resolution Bullish Consensus Trigger (>=3 Timeframes Buy)"
            );
        } else if ("BEARISH_CONSENSUS".equals(code)) {
            lastSignalEmittedTimeMs.put(symbol, now);
            log.info("📉 MultiResolutionStrategy: Triggering Automated SELL for {} @ ${}", symbol, result.lastPx());
            return Signal.marketSell(
                    getName(),
                    symbol,
                    100.0,
                    "Multi-Resolution Bearish Consensus Trigger (>=2 Timeframes Sell)"
            );
        }

        return null;
    }

    public TimeframeSignalResult evaluateTimeframeSignal(List<BarData> resampledBars, MultiResolutionSpec spec, String tfCode) {
        if (resampledBars == null || resampledBars.size() < 20) {
            return new TimeframeSignalResult(
                    tfCode, "NO_DATA", "❓ NO BARS",
                    0.0, 0.0, 50.0, 0.0, 0.0, "LowVol", "Insufficient bar data"
            );
        }

        IndicatorCalculator.IndicatorSnapshot snapshot = IndicatorCalculator.computeIndicators(resampledBars);
        double z = snapshot.zScore();
        double rsi = snapshot.rsi();
        double adx = snapshot.adx();
        double macd = snapshot.macdHist();
        String regime = snapshot.regime() == 0 ? "LowVol" : "HighVol";

        double tpZ = spec.takeProfitZscore();
        boolean entryTrigger = (z < -tpZ);

        boolean rsiOk = (spec.maxRsiThreshold() == null) || (rsi <= spec.maxRsiThreshold());
        boolean adxOk = (spec.maxAdxThreshold() == null) || (adx <= spec.maxAdxThreshold());
        boolean macdOk = (!spec.requireMacdBullish()) || (macd > 0);
        boolean regimeOk = (!spec.useHmmFilter()) || (snapshot.regime() == 0);

        boolean filtersPassed = rsiOk && adxOk && macdOk && regimeOk;

        if (entryTrigger && filtersPassed) {
            return new TimeframeSignalResult(
                    tfCode, "BUY", "🚀 BUY",
                    snapshot.lastPx(), z, rsi, adx, macd, regime, "Strong Oversold Buy"
            );
        } else if (entryTrigger) {
            List<String> reasons = new ArrayList<>();
            if (!rsiOk) reasons.add(String.format("RSI=%.1f>%.1f", rsi, spec.maxRsiThreshold()));
            if (!adxOk) reasons.add(String.format("ADX=%.1f>%.1f", adx, spec.maxAdxThreshold()));
            if (!macdOk) reasons.add("MACD<=0");
            if (!regimeOk) reasons.add("HighVol");
            return new TimeframeSignalResult(
                    tfCode, "FILTERED", "⚠️ FILTERED",
                    snapshot.lastPx(), z, rsi, adx, macd, regime, "Filtered (" + String.join(", ", reasons) + ")"
            );
        } else if (z > tpZ) {
            return new TimeframeSignalResult(
                    tfCode, "SELL", "📉 SELL",
                    snapshot.lastPx(), z, rsi, adx, macd, regime, "Overbought Reversal / Exit"
            );
        } else {
            return new TimeframeSignalResult(
                    tfCode, "HOLD", "🔍 HOLD",
                    snapshot.lastPx(), z, rsi, adx, macd, regime, "Neutral Range"
            );
        }
    }

    private record ConsensusEvaluation(String code, String badge) {}

    public ConsensusEvaluation deriveConsensus(Map<String, TimeframeSignalResult> signals) {
        int buyCount = 0;
        int sellCount = 0;
        int filteredCount = 0;

        for (TimeframeSignalResult sig : signals.values()) {
            switch (sig.signal()) {
                case "BUY" -> buyCount++;
                case "SELL" -> sellCount++;
                case "FILTERED" -> filteredCount++;
            }
        }

        if (buyCount >= 3) {
            return new ConsensusEvaluation("BULLISH_CONSENSUS", "🚀 STRONG BUY (Multi-Timeframe)");
        } else if (buyCount >= 1) {
            return new ConsensusEvaluation("MILD_BULLISH", "🔍 MILD BUY (Single TF Trigger)");
        } else if (sellCount >= 2) {
            return new ConsensusEvaluation("BEARISH_CONSENSUS", "📉 STRONG SELL (Overbought Reversal)");
        } else if (sellCount == 1) {
            return new ConsensusEvaluation("MILD_BEARISH", "🔍 MILD SELL / EXIT");
        } else if (filteredCount >= 2) {
            return new ConsensusEvaluation("FILTERED_OVERSOLD", "⚠️ FILTERED OVERSOLD (Awaiting Filter Reset)");
        } else {
            return new ConsensusEvaluation("NEUTRAL", "🔍 NEUTRAL / FLAT (Hold Cash)");
        }
    }

    public Map<String, SymbolConsensusResult> getLatestConsensusMap() {
        return Collections.unmodifiableMap(latestConsensus);
    }

    /**
     * Preloads buffer bars (e.g. from QuestDB history).
     */
    public void seedBars(String symbol, List<BarData> bars) {
        if (symbol == null || bars == null || bars.isEmpty()) return;
        String sym = symbol.toUpperCase();
        List<BarData> buffer = barBuffers.computeIfAbsent(sym, k -> new ArrayList<>());
        synchronized (buffer) {
            buffer.clear();
            buffer.addAll(bars);
        }
        evaluateSymbol(sym);
    }
}
