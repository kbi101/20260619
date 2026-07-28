package com.quantstation.strategy.multiresolution;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Map;

/**
 * Service to generate structured JSON matrices and Markdown Multi-Resolution Recommendation Reports.
 */
@Service
public class MultiResolutionReportService {

    private static final Logger log = LoggerFactory.getLogger(MultiResolutionReportService.class);
    private final MultiResolutionStrategy strategy;

    public MultiResolutionReportService(MultiResolutionStrategy strategy) {
        this.strategy = strategy;
    }

    public String generateMarkdownReport() {
        Map<String, MultiResolutionStrategy.SymbolConsensusResult> consensusMap = strategy.getLatestConsensusMap();

        String nowStr = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss 'UTC'")
                .withZone(ZoneOffset.UTC)
                .format(Instant.now());

        StringBuilder sb = new StringBuilder();
        sb.append("# QuantStation Multi-Resolution Live Recommendation Report\n\n");
        sb.append("**Generated:** ").append(nowStr).append("  \n");
        sb.append("**Data Mode:** 🔴 **REAL-TIME QUANTSTATION FEED / QUESTDB BARS**  \n");
        sb.append("**Multi-Resolution Signal Coverage:** 2-Minute | 5-Minute | 15-Minute | 30-Minute | 1-Hour | 4-Hour  \n");
        sb.append("**Strategy Engine:** Multi-Condition Z-Score Mean-Reversion Engine  \n\n");
        sb.append("---\n\n");
        sb.append("## 1. Executive Summary & Multi-Resolution Consensus Matrix\n\n");
        sb.append("| Symbol | Last Px | 2-Min | 5-Min | 15-Min | 30-Min | 1-Hour | 4-Hour | Multi-Resolution Consensus |\n");
        sb.append("|---|---|---|---|---|---|---|---|---|\n");

        if (consensusMap.isEmpty()) {
            sb.append("| *No Symbol Data Evaluated Yet* | N/A | N/A | N/A | N/A | N/A | N/A | N/A | 🔍 NEUTRAL |\n");
        } else {
            for (Map.Entry<String, MultiResolutionStrategy.SymbolConsensusResult> entry : consensusMap.entrySet()) {
                String sym = entry.getKey();
                MultiResolutionStrategy.SymbolConsensusResult res = entry.getValue();

                Map<String, MultiResolutionStrategy.TimeframeSignalResult> sigs = res.signals();
                String s2m = getBadge(sigs, "2m");
                String s5m = getBadge(sigs, "5m");
                String s15m = getBadge(sigs, "15m");
                String s30m = getBadge(sigs, "30m");
                String s1h = getBadge(sigs, "1h");
                String s4h = getBadge(sigs, "4h");

                sb.append(String.format("| **%s** | $%.2f | %s | %s | %s | %s | %s | %s | **%s** |\n",
                        sym, res.lastPx(), s2m, s5m, s15m, s30m, s1h, s4h, res.consensusBadge()));
            }
        }

        sb.append("\n---\n\n");
        sb.append("## 2. Per-Symbol Multi-Timeframe Signal Breakdown\n\n");

        for (Map.Entry<String, MultiResolutionStrategy.SymbolConsensusResult> entry : consensusMap.entrySet()) {
            String sym = entry.getKey();
            MultiResolutionStrategy.SymbolConsensusResult res = entry.getValue();

            sb.append("### ").append(sym).append("\n\n");
            sb.append("**Consensus Recommendation:** ").append(res.consensusBadge()).append("  \n\n");
            sb.append("| Timeframe | Last Px | Z-Score | RSI | ADX | MACD Hist | Regime | Live Signal | Signal Details |\n");
            sb.append("|---|---|---|---|---|---|---|---|---|\n");

            for (String tfCode : MultiResolutionStrategy.TIMEFRAME_CODES) {
                MultiResolutionStrategy.TimeframeSignalResult s = res.signals().get(tfCode);
                if (s == null || "NO_DATA".equals(s.signal())) {
                    sb.append(String.format("| `%s` | N/A | N/A | N/A | N/A | N/A | N/A | %s | %s |\n",
                            tfCode, s != null ? s.badge() : "❓ NO DATA", s != null ? s.details() : "No bar data"));
                } else {
                    sb.append(String.format("| `%s` | $%.2f | %+%.2f | %.1f | %.1f | %+%.3f | %s | **%s** | %s |\n",
                            tfCode, s.lastPx(), s.zScore(), s.rsi(), s.adx(), s.macdHist(), s.regimeLabel(), s.badge(), s.details()));
                }
            }
            sb.append("\n---\n\n");
        }

        return sb.toString();
    }

    private String getBadge(Map<String, MultiResolutionStrategy.TimeframeSignalResult> map, String tf) {
        MultiResolutionStrategy.TimeframeSignalResult res = map.get(tf);
        return res != null ? res.badge() : "❓ N/A";
    }
}
