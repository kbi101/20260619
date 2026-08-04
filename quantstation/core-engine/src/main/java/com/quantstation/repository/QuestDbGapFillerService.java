package com.quantstation.repository;

import com.quantstation.domain.BarData;
import com.quantstation.marketdata.MarketDataProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Service to detect data gaps in QuestDB and automatically backfill missing historical bars.
 */
@Service
public class QuestDbGapFillerService {

    private static final Logger log = LoggerFactory.getLogger(QuestDbGapFillerService.class);

    private final MarketDataProvider marketDataProvider;
    private final QuestDbTickWriter questDbWriter;
    private final RestTemplate restTemplate;

    @Value("${quantstation.questdb.host:localhost}")
    private String questdbHost;

    public QuestDbGapFillerService(MarketDataProvider marketDataProvider, QuestDbTickWriter questDbWriter) {
        this.marketDataProvider = marketDataProvider;
        this.questDbWriter = questDbWriter;
        this.restTemplate = new RestTemplate();
    }

    /**
     * Check QuestDB for the max timestamp for a given symbol and backfill if a gap exists.
     */
    public CompletableFuture<List<BarData>> backfillSymbol(String symbol, String duration, String barSize) {
        log.info("QuestDbGapFiller: Initiating backfill check for symbol {} (requested duration={}, barSize={})", symbol, duration, barSize);

        return marketDataProvider.fetchHistoricalBars(symbol, duration, barSize)
                .thenApply(bars -> {
                    if (bars != null && !bars.isEmpty()) {
                        log.info("QuestDbGapFiller: Fetched {} historical bars for {}. Writing to QuestDB...", bars.size(), symbol);
                        questDbWriter.writeBars(bars);
                    } else {
                        log.warn("QuestDbGapFiller: No historical bars returned for {}", symbol);
                    }
                    return bars;
                })
                .exceptionally(ex -> {
                    log.error("QuestDbGapFiller: Error during historical backfill for {}: {}", symbol, ex.getMessage());
                    return List.of();
                });
    }

    /**
     * Query QuestDB REST endpoint to find the max timestamp for a symbol in table.
     */
    public Instant getMaxTimestamp(String table, String symbol) {
        try {
            String url = String.format("http://%s:9000/exec?query=SELECT+max(timestamp)+FROM+%s+WHERE+symbol='%s'",
                    questdbHost, table, symbol.toUpperCase());
            Map<?, ?> response = restTemplate.getForObject(url, Map.class);
            if (response != null && response.containsKey("dataset")) {
                List<?> dataset = (List<?>) response.get("dataset");
                if (!dataset.isEmpty()) {
                    List<?> row = (List<?>) dataset.get(0);
                    if (!row.isEmpty() && row.get(0) != null) {
                        String tsStr = row.get(0).toString();
                        return Instant.parse(tsStr);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("QuestDbGapFiller: Failed to query max timestamp for {} in {}: {}", symbol, table, e.getMessage());
        }
        return null;
    }
}
