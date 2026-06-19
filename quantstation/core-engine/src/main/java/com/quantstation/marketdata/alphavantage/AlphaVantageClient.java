package com.quantstation.marketdata.alphavantage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Alpha Vantage REST client for supplementary market data.
 *
 * <p>Provides:
 * <ul>
 *   <li>Fundamental data (earnings, balance sheet, cash flow)</li>
 *   <li>Historical end-of-day OHLCV</li>
 *   <li>Economic indicators</li>
 *   <li>Technical indicators (SMA, EMA, RSI, etc.)</li>
 * </ul>
 *
 * <p>Rate-limited to 5 requests/minute (free tier).
 * Results are cached in Redis with configurable TTL.
 */
@Component
public class AlphaVantageClient {

    private static final Logger log = LoggerFactory.getLogger(AlphaVantageClient.class);

    @Value("${quantstation.alphavantage.api-key:}")
    private String apiKey;

    @Value("${quantstation.alphavantage.base-url:https://www.alphavantage.co/query}")
    private String baseUrl;

    @Value("${quantstation.alphavantage.cache-ttl-minutes:60}")
    private int cacheTtlMinutes;

    private final RestTemplate restTemplate;
    private final RedisTemplate<String, Object> redisTemplate;

    // Simple rate limiter — track last request time
    private volatile long lastRequestTimeMs = 0;
    private static final long MIN_INTERVAL_MS = 12_000; // 5 req/min = 12s between requests

    public AlphaVantageClient(RedisTemplate<String, Object> redisTemplate) {
        this.restTemplate = new RestTemplate();
        this.redisTemplate = redisTemplate;
    }

    /**
     * Fetch daily OHLCV data for a symbol.
     *
     * @param symbol The ticker symbol
     * @param full   If true, returns full history (20+ years); otherwise last 100 days
     * @return JSON response as Map, or null on error
     */
    @Async
    public Map<String, Object> getDailyPrices(String symbol, boolean full) {
        String cacheKey = "qs:av:daily:" + symbol;
        return cachedRequest(cacheKey, Map.of(
                "function", "TIME_SERIES_DAILY_ADJUSTED",
                "symbol", symbol,
                "outputsize", full ? "full" : "compact"
        ));
    }

    /**
     * Fetch company overview (fundamentals).
     */
    @Async
    public Map<String, Object> getCompanyOverview(String symbol) {
        String cacheKey = "qs:av:overview:" + symbol;
        return cachedRequest(cacheKey, Map.of(
                "function", "OVERVIEW",
                "symbol", symbol
        ));
    }

    /**
     * Fetch earnings data.
     */
    @Async
    public Map<String, Object> getEarnings(String symbol) {
        String cacheKey = "qs:av:earnings:" + symbol;
        return cachedRequest(cacheKey, Map.of(
                "function", "EARNINGS",
                "symbol", symbol
        ));
    }

    /**
     * Fetch a technical indicator.
     *
     * @param symbol   Ticker symbol
     * @param function Alpha Vantage function (e.g., "SMA", "EMA", "RSI")
     * @param interval Time interval (e.g., "daily", "weekly")
     * @param period   Time period (e.g., 20 for SMA-20)
     */
    @Async
    public Map<String, Object> getTechnicalIndicator(String symbol, String function,
                                                      String interval, int period) {
        String cacheKey = String.format("qs:av:tech:%s:%s:%s:%d",
                symbol, function, interval, period);
        return cachedRequest(cacheKey, Map.of(
                "function", function,
                "symbol", symbol,
                "interval", interval,
                "time_period", String.valueOf(period),
                "series_type", "close"
        ));
    }

    // ── Internal ────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> cachedRequest(String cacheKey, Map<String, String> params) {
        // Check cache first
        Object cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached instanceof Map) {
            log.debug("AlphaVantage: Cache hit for {}", cacheKey);
            return (Map<String, Object>) cached;
        }

        // Rate limit
        enforceRateLimit();

        // Build URL
        StringBuilder url = new StringBuilder(baseUrl).append("?apikey=").append(apiKey);
        params.forEach((k, v) -> url.append("&").append(k).append("=").append(v));

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> result = restTemplate.getForObject(url.toString(), Map.class);

            if (result != null && !result.containsKey("Error Message")) {
                // Cache the result
                redisTemplate.opsForValue().set(cacheKey, result,
                        Duration.ofMinutes(cacheTtlMinutes));
                log.info("AlphaVantage: Fetched and cached {}", cacheKey);
            }

            return result;
        } catch (Exception e) {
            log.error("AlphaVantage: Request failed for {}", cacheKey, e);
            return null;
        }
    }

    private synchronized void enforceRateLimit() {
        long now = System.currentTimeMillis();
        long elapsed = now - lastRequestTimeMs;
        if (elapsed < MIN_INTERVAL_MS) {
            try {
                long waitMs = MIN_INTERVAL_MS - elapsed;
                log.debug("AlphaVantage: Rate limiting — waiting {}ms", waitMs);
                TimeUnit.MILLISECONDS.sleep(waitMs);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        lastRequestTimeMs = System.currentTimeMillis();
    }
}
