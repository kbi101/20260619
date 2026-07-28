package com.quantstation.strategy.multiresolution;

import com.quantstation.domain.BarData;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Resamples 1-minute BarData series into target timeframe resolutions (2m, 5m, 15m, 30m, 1h, 4h).
 */
public class TimeframeResampler {

    public static List<BarData> resample(List<BarData> bars1m, String timeframeCode) {
        int windowMinutes = parseTimeframeMinutes(timeframeCode);
        if (bars1m == null || bars1m.isEmpty()) {
            return List.of();
        }
        if (windowMinutes <= 1) {
            return new ArrayList<>(bars1m);
        }

        List<BarData> sortedBars = bars1m.stream()
                .sorted(Comparator.comparing(BarData::barStart))
                .toList();

        List<BarData> resampled = new ArrayList<>();
        List<BarData> currentBucket = new ArrayList<>();
        long bucketWindowSeconds = windowMinutes * 60L;

        long currentBucketStartSec = -1;

        for (BarData bar : sortedBars) {
            long barSec = bar.barStart().getEpochSecond();
            long bucketStartSec = (barSec / bucketWindowSeconds) * bucketWindowSeconds;

            if (currentBucketStartSec == -1) {
                currentBucketStartSec = bucketStartSec;
            }

            if (bucketStartSec != currentBucketStartSec && !currentBucket.isEmpty()) {
                resampled.add(buildAggregatedBar(currentBucket, timeframeCode));
                currentBucket.clear();
                currentBucketStartSec = bucketStartSec;
            }

            currentBucket.add(bar);
        }

        if (!currentBucket.isEmpty()) {
            resampled.add(buildAggregatedBar(currentBucket, timeframeCode));
        }

        return resampled;
    }

    private static BarData buildAggregatedBar(List<BarData> bucket, String timeframeCode) {
        BarData first = bucket.get(0);
        BarData last = bucket.get(bucket.size() - 1);

        String symbol = first.symbol();
        double open = first.open();
        double close = last.close();
        double high = Double.NEGATIVE_INFINITY;
        double low = Double.POSITIVE_INFINITY;
        long totalVolume = 0;
        double volumePriceSum = 0.0;
        int totalTrades = 0;

        for (BarData b : bucket) {
            if (b.high() > high) high = b.high();
            if (b.low() < low) low = b.low();
            totalVolume += b.volume();
            volumePriceSum += (b.vwap() * b.volume());
            totalTrades += b.tradeCount();
        }

        if (high == Double.NEGATIVE_INFINITY) high = open;
        if (low == Double.POSITIVE_INFINITY) low = open;

        double vwap = totalVolume > 0 ? (volumePriceSum / totalVolume) : close;

        return new BarData(
                symbol,
                timeframeCode,
                open,
                high,
                low,
                close,
                totalVolume,
                vwap,
                totalTrades,
                first.barStart(),
                last.barEnd(),
                last.timestamp()
        );
    }

    public static int parseTimeframeMinutes(String code) {
        return switch (code.toLowerCase()) {
            case "2m" -> 2;
            case "5m" -> 5;
            case "15m" -> 15;
            case "30m" -> 30;
            case "1h" -> 60;
            case "4h" -> 240;
            default -> 1;
        };
    }
}
