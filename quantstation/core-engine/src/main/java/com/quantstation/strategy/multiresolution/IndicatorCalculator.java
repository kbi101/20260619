package com.quantstation.strategy.multiresolution;

import com.quantstation.domain.BarData;

import java.util.List;

/**
 * Technical Indicator Calculation Engine for Multi-Resolution Signal Evaluation.
 */
public class IndicatorCalculator {

    public record IndicatorSnapshot(
            double lastPx,
            double zScore,
            double rsi,
            double adx,
            double macdHist,
            int regime // 0 = LowVol, 1 = HighVol
    ) {}

    public static IndicatorSnapshot computeIndicators(List<BarData> bars) {
        if (bars == null || bars.size() < 20) {
            return new IndicatorSnapshot(
                    bars != null && !bars.isEmpty() ? bars.get(bars.size() - 1).close() : 0.0,
                    0.0, 50.0, 0.0, 0.0, 0
            );
        }

        int n = bars.size();
        double[] closes = new double[n];
        double[] highs = new double[n];
        double[] lows = new double[n];

        for (int i = 0; i < n; i++) {
            BarData b = bars.get(i);
            closes[i] = b.close();
            highs[i] = b.high();
            lows[i] = b.low();
        }

        double lastPx = closes[n - 1];
        double zScore = computeZScore(closes, 20);
        double rsi = computeRSI(closes, 14);
        double adx = computeADX(highs, lows, closes, 14);
        double macdHist = computeMACDHist(closes, 12, 26, 9);
        int regime = computeRegime(closes, 20);

        return new IndicatorSnapshot(lastPx, zScore, rsi, adx, macdHist, regime);
    }

    public static double computeZScore(double[] prices, int period) {
        if (prices.length < period) return 0.0;
        int start = prices.length - period;
        double sum = 0.0;
        for (int i = start; i < prices.length; i++) {
            sum += prices[i];
        }
        double mean = sum / period;

        double varianceSum = 0.0;
        for (int i = start; i < prices.length; i++) {
            varianceSum += Math.pow(prices[i] - mean, 2);
        }
        double stdDev = Math.sqrt(varianceSum / (period - 1));
        if (stdDev == 0.0 || Double.isNaN(stdDev)) return 0.0;

        double lastPx = prices[prices.length - 1];
        return (lastPx - mean) / stdDev;
    }

    public static double computeRSI(double[] prices, int period) {
        if (prices.length <= period) return 50.0;

        double gainSum = 0.0;
        double lossSum = 0.0;

        for (int i = 1; i <= period; i++) {
            double change = prices[i] - prices[i - 1];
            if (change > 0) gainSum += change;
            else lossSum += Math.abs(change);
        }

        double avgGain = gainSum / period;
        double avgLoss = lossSum / period;

        for (int i = period + 1; i < prices.length; i++) {
            double change = prices[i] - prices[i - 1];
            double gain = change > 0 ? change : 0.0;
            double loss = change < 0 ? Math.abs(change) : 0.0;

            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;
        }

        if (avgLoss == 0.0) return 100.0;
        double rs = avgGain / avgLoss;
        return 100.0 - (100.0 / (1.0 + rs));
    }

    public static double computeADX(double[] highs, double[] lows, double[] closes, int period) {
        int n = closes.length;
        if (n <= period * 2) return 20.0;

        double[] tr = new double[n];
        double[] plusDM = new double[n];
        double[] minusDM = new double[n];

        for (int i = 1; i < n; i++) {
            double hDiff = highs[i] - highs[i - 1];
            double lDiff = lows[i - 1] - lows[i];

            plusDM[i] = (hDiff > lDiff && hDiff > 0) ? hDiff : 0.0;
            minusDM[i] = (lDiff > hDiff && lDiff > 0) ? lDiff : 0.0;

            double tr1 = highs[i] - lows[i];
            double tr2 = Math.abs(highs[i] - closes[i - 1]);
            double tr3 = Math.abs(lows[i] - closes[i - 1]);
            tr[i] = Math.max(tr1, Math.max(tr2, tr3));
        }

        double smoothTR = 0.0;
        double smoothPlusDM = 0.0;
        double smoothMinusDM = 0.0;

        for (int i = 1; i <= period; i++) {
            smoothTR += tr[i];
            smoothPlusDM += plusDM[i];
            smoothMinusDM += minusDM[i];
        }

        double[] dx = new double[n];
        for (int i = period + 1; i < n; i++) {
            smoothTR = smoothTR - (smoothTR / period) + tr[i];
            smoothPlusDM = smoothPlusDM - (smoothPlusDM / period) + plusDM[i];
            smoothMinusDM = smoothMinusDM - (smoothMinusDM / period) + minusDM[i];

            double plusDI = smoothTR > 0 ? (100.0 * smoothPlusDM / smoothTR) : 0.0;
            double minusDI = smoothTR > 0 ? (100.0 * smoothMinusDM / smoothTR) : 0.0;

            double diSum = plusDI + minusDI;
            dx[i] = diSum > 0 ? (100.0 * Math.abs(plusDI - minusDI) / diSum) : 0.0;
        }

        double adxSum = 0.0;
        int adxCount = 0;
        for (int i = period * 2; i < n; i++) {
            adxSum += dx[i];
            adxCount++;
        }

        return adxCount > 0 ? (adxSum / adxCount) : 20.0;
    }

    public static double computeMACDHist(double[] prices, int fast, int slow, int signal) {
        if (prices.length < slow + signal) return 0.0;

        double[] emaFast = computeEMA(prices, fast);
        double[] emaSlow = computeEMA(prices, slow);
        double[] macdLine = new double[prices.length];

        for (int i = 0; i < prices.length; i++) {
            macdLine[i] = emaFast[i] - emaSlow[i];
        }

        double[] signalLine = computeEMA(macdLine, signal);
        int lastIdx = prices.length - 1;
        return macdLine[lastIdx] - signalLine[lastIdx];
    }

    private static double[] computeEMA(double[] values, int period) {
        double[] ema = new double[values.length];
        double multiplier = 2.0 / (period + 1);

        ema[0] = values[0];
        for (int i = 1; i < values.length; i++) {
            ema[i] = (values[i] - ema[i - 1]) * multiplier + ema[i - 1];
        }
        return ema;
    }

    public static int computeRegime(double[] prices, int period) {
        int n = prices.length;
        if (n < period + 1) return 0;

        double[] returns = new double[period];
        double sumRet = 0.0;
        int idx = 0;

        for (int i = n - period; i < n; i++) {
            double ret = (prices[i] - prices[i - 1]) / prices[i - 1];
            returns[idx++] = ret;
            sumRet += ret;
        }

        double meanRet = sumRet / period;
        double varSum = 0.0;
        for (double r : returns) {
            varSum += Math.pow(r - meanRet, 2);
        }
        double stdRet = Math.sqrt(varSum / period);

        // Standard volatility threshold for 1-minute returns regime classification
        return stdRet > 0.0035 ? 1 : 0;
    }
}
