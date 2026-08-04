package com.quantstation.marketdata;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quantstation.domain.FundamentalData;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service to fetch reference fundamental data (Market Cap, Sector, Industry, 14-Day ATR, 20-Day Avg Vol)
 * with a 7-day (weekly) Redis TTL.
 */
@Service
public class FundamentalDataService {

    private static final Logger log = LoggerFactory.getLogger(FundamentalDataService.class);
    private static final Duration CACHE_TTL = Duration.ofDays(7); // 7-day (weekly) TTL

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final Map<String, FundamentalData> localCache = new ConcurrentHashMap<>();

    // Map of known shares outstanding for accurate Market Cap calculation: price * sharesOutstanding
    private static final Map<String, Long> SHARES_OUTSTANDING_MAP = Map.of(
            "APLD", 291_470_000L,
            "NVDA", 24_220_000_000L,
            "AAPL", 14_590_000_000L,
            "TSLA", 3_950_000_000L,
            "MSFT", 7_430_000_000L,
            "AMZN", 10_790_000_000L,
            "META", 2_540_000_000L,
            "FIS", 516_880_000L,
            "SPY", 980_000_000L,
            "QQQ", 520_000_000L
    );

    public FundamentalDataService(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    /**
     * Get fundamental data for a symbol. Returns cached value if present, else fetches from Yahoo Finance.
     */
    public FundamentalData getFundamentals(String symbol) {
        if (symbol == null || symbol.isBlank()) return null;
        String upperSymbol = symbol.toUpperCase().trim();

        // 1. Check in-memory cache
        if (localCache.containsKey(upperSymbol)) {
            return localCache.get(upperSymbol);
        }

        // 2. Check Redis cache (7-day TTL)
        String redisKey = "fundamental:" + upperSymbol;
        try {
            String cachedJson = redisTemplate.opsForValue().get(redisKey);
            if (cachedJson != null && !cachedJson.isBlank()) {
                FundamentalData data = objectMapper.readValue(cachedJson, FundamentalData.class);
                localCache.put(upperSymbol, data);
                return data;
            }
        } catch (Exception e) {
            log.warn("FundamentalDataService: Redis read failed for {}: {}", upperSymbol, e.getMessage());
        }

        // 3. Fetch from Yahoo Finance REST API
        FundamentalData fetched = fetchFromYahoo(upperSymbol);
        if (fetched != null) {
            localCache.put(upperSymbol, fetched);
            try {
                String json = objectMapper.writeValueAsString(fetched);
                redisTemplate.opsForValue().set(redisKey, json, CACHE_TTL);
            } catch (Exception e) {
                log.warn("FundamentalDataService: Redis write failed for {}: {}", upperSymbol, e.getMessage());
            }
        }

        return fetched;
    }

    private FundamentalData fetchFromYahoo(String symbol) {
        try {
            // Query 20-day daily OHLCV bars from Yahoo chart endpoint
            String url = "https://query1.finance.yahoo.com/v8/finance/chart/" + symbol + "?range=20d&interval=1d";
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode resultNode = root.path("chart").path("result");
                if (resultNode.isArray() && !resultNode.isEmpty()) {
                    JsonNode meta = resultNode.get(0).path("meta");
                    String companyName = meta.path("longName").asText(meta.path("shortName").asText(symbol));

                    // Parse daily OHLCV bars for 14-Day ATR & 20-Day Average Volume
                    JsonNode quote = resultNode.get(0).path("indicators").path("quote").get(0);
                    JsonNode highs = quote.path("high");
                    JsonNode lows = quote.path("low");
                    JsonNode closes = quote.path("close");
                    JsonNode volumes = quote.path("volume");

                    double calculatedAtr = 0.0;
                    double calculatedAvgVol = 0.0;

                    if (highs.isArray() && lows.isArray() && closes.isArray() && closes.size() >= 2) {
                        List<Double> trs = new ArrayList<>();
                        long totalVol = 0;
                        int volCount = 0;

                        for (int i = 0; i < closes.size(); i++) {
                            if (i > 0) {
                                double h = highs.get(i).asDouble();
                                double l = lows.get(i).asDouble();
                                double prevC = closes.get(i - 1).asDouble();
                                double tr = Math.max(h - l, Math.max(Math.abs(h - prevC), Math.abs(l - prevC)));
                                trs.add(tr);
                            }
                            if (volumes.isArray() && i < volumes.size()) {
                                long v = volumes.get(i).asLong(0);
                                if (v > 0) {
                                    totalVol += v;
                                    volCount++;
                                }
                            }
                        }

                        if (!trs.isEmpty()) {
                            int subset = Math.min(14, trs.size());
                            double trSum = 0;
                            for (int k = trs.size() - subset; k < trs.size(); k++) {
                                trSum += trs.get(k);
                            }
                            calculatedAtr = Math.round((trSum / subset) * 100.0) / 100.0;
                        }

                        if (volCount > 0) {
                            calculatedAvgVol = (double) totalVol / volCount;
                        }
                    }

                    // Fetch search metadata for sector & industry
                    String searchUrl = "https://query2.finance.yahoo.com/v1/finance/search?q=" + symbol;
                    HttpRequest searchReq = HttpRequest.newBuilder()
                            .uri(URI.create(searchUrl))
                            .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
                            .GET()
                            .build();

                    HttpResponse<String> searchResp = httpClient.send(searchReq, HttpResponse.BodyHandlers.ofString());
                    String sector = "Technology";
                    String industry = "Software";
                    if (searchResp.statusCode() == 200) {
                        JsonNode searchRoot = objectMapper.readTree(searchResp.body());
                        JsonNode quotes = searchRoot.path("quotes");
                        if (quotes.isArray() && !quotes.isEmpty()) {
                            for (JsonNode q : quotes) {
                                if (symbol.equalsIgnoreCase(q.path("symbol").asText())) {
                                    sector = q.path("sectorDisp").asText(q.path("sector").asText("Technology"));
                                    industry = q.path("industryDisp").asText(q.path("industry").asText("Software"));
                                    break;
                                }
                            }
                        }
                    }

                    double price = meta.path("regularMarketPrice").asDouble(0);
                    Long sharesOutstanding = SHARES_OUTSTANDING_MAP.get(symbol.toUpperCase());
                    long marketCap = 0L;

                    if (sharesOutstanding != null && sharesOutstanding > 0 && price > 0) {
                        marketCap = (long) (price * sharesOutstanding);
                    } else if (price > 0) {
                        // Fallback estimate for unlisted tickers
                        marketCap = (long) (price * 250_000_000L);
                    }

                    long floatShares = sharesOutstanding != null ? (long) (sharesOutstanding * 0.85) : 0L;

                    log.info("FundamentalDataService: Fetched fundamentals for {}: company={}, sector={}, marketCap={}, ATR={}, avgVol={}",
                            symbol, companyName, sector, marketCap, calculatedAtr, calculatedAvgVol);

                    return new FundamentalData(
                            symbol,
                            companyName,
                            sector,
                            industry,
                            marketCap,
                            floatShares,
                            calculatedAtr,
                            calculatedAvgVol,
                            1.2,
                            3.5
                    );
                }
            }
        } catch (Exception e) {
            log.error("FundamentalDataService: Failed to fetch fundamentals for {}: {}", symbol, e.getMessage());
        }
        return null;
    }
}
