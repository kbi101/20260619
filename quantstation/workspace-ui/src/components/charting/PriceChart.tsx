import React, { useEffect, useRef, useState } from 'react'
import { createChart, type IChartApi, type ISeriesApi, ColorType } from 'lightweight-charts'
import { useStore } from '../../store/useStore'
import * as ChartDataManager from '../../services/ChartDataManager'

// ═══════════════════════════════════════════════════════
// Technical Indicator Math Helpers
// ═══════════════════════════════════════════════════════

function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = []
  if (data.length === 0) return ema
  const k = 2 / (period + 1)
  let prevEma = data[0]
  ema.push(prevEma)

  for (let i = 1; i < data.length; i++) {
    const val = data[i] * k + prevEma * (1 - k)
    ema.push(val)
    prevEma = val
  }

  for (let i = 0; i < period - 1 && i < ema.length; i++) {
    ema[i] = NaN
  }
  return ema
}

function calculateBollingerBands(data: number[], period = 20, multiplier = 2) {
  const middle: number[] = []
  const upper: number[] = []
  const lower: number[] = []

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      middle.push(NaN)
      upper.push(NaN)
      lower.push(NaN)
    } else {
      let sum = 0
      for (let j = 0; j < period; j++) {
        sum += data[i - j]
      }
      const avg = sum / period
      middle.push(avg)

      let varianceSum = 0
      for (let j = 0; j < period; j++) {
        varianceSum += Math.pow(data[i - j] - avg, 2)
      }
      const stdDev = Math.sqrt(varianceSum / period)
      upper.push(avg + multiplier * stdDev)
      lower.push(avg - multiplier * stdDev)
    }
  }
  return { middle, upper, lower }
}

function calculateVWAP(bars: { time: number; high: number; low: number; close: number; volume: number }[]): number[] {
  const vwap: number[] = []
  let cumulativePV = 0
  let cumulativeV = 0
  let prevDayStr = ''

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]
    const typicalPrice = (bar.high + bar.low + bar.close) / 3
    const offsetMinutes = new Date().getTimezoneOffset()
    const offsetSeconds = offsetMinutes * 60
    const date = new Date((bar.time + offsetSeconds) * 1000)
    const dayStr = date.toDateString()

    // Daily reset
    if (dayStr !== prevDayStr) {
      cumulativePV = 0
      cumulativeV = 0
      prevDayStr = dayStr
    }

    cumulativePV += typicalPrice * bar.volume
    cumulativeV += bar.volume

    vwap.push(cumulativeV > 0 ? cumulativePV / cumulativeV : typicalPrice)
  }
  return vwap
}

function calculateRSI(data: number[], period = 14): number[] {
  const rsi: number[] = []
  if (data.length === 0) return rsi

  let avgGain = 0
  let avgLoss = 0

  rsi.push(NaN)

  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0

    if (i < period) {
      avgGain += gain
      avgLoss += loss
      rsi.push(NaN)
      if (i === period - 1) {
        avgGain /= period
        avgLoss /= period
      }
    } else {
      if (i === period) {
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
        rsi.push(100 - 100 / (1 + rs))
      } else {
        avgGain = (avgGain * (period - 1) + gain) / period
        avgLoss = (avgLoss * (period - 1) + loss) / period
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
        rsi.push(100 - 100 / (1 + rs))
      }
    }
  }

  for (let i = 0; i < period && i < rsi.length; i++) {
    rsi[i] = NaN
  }
  return rsi
}

function calculateMACD(data: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const emaFast = calculateEMA(data, fastPeriod)
  const emaSlow = calculateEMA(data, slowPeriod)

  const macdLine: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (isNaN(emaFast[i]) || isNaN(emaSlow[i])) {
      macdLine.push(NaN)
    } else {
      macdLine.push(emaFast[i] - emaSlow[i])
    }
  }

  const nonNaNMacd = macdLine.filter((x) => !isNaN(x))
  const rawSignal = calculateEMA(nonNaNMacd, signalPeriod)

  const signalLine: number[] = []
  let sigIdx = 0
  for (let i = 0; i < data.length; i++) {
    if (isNaN(macdLine[i])) {
      signalLine.push(NaN)
    } else {
      signalLine.push(rawSignal[sigIdx++])
    }
  }

  const histogram: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (isNaN(macdLine[i]) || isNaN(signalLine[i])) {
      histogram.push(NaN)
    } else {
      histogram.push(macdLine[i] - signalLine[i])
    }
  }

  return { macdLine, signalLine, histogram }
}

function calculateADX(bars: { high: number; low: number; close: number }[], period = 14) {
  const adxValues: number[] = []
  const plusDIValues: number[] = []
  const minusDIValues: number[] = []

  if (bars.length < 2) {
    const empty = bars.map(() => NaN)
    return { adx: empty, plusDI: empty, minusDI: empty }
  }

  const tr: number[] = []
  const plusDM: number[] = []
  const minusDM: number[] = []

  for (let i = 1; i < bars.length; i++) {
    const cur = bars[i]
    const prev = bars[i - 1]

    const tr1 = cur.high - cur.low
    const tr2 = Math.abs(cur.high - prev.close)
    const tr3 = Math.abs(cur.low - prev.close)
    tr.push(Math.max(tr1, tr2, tr3))

    const upMove = cur.high - prev.high
    const downMove = prev.low - cur.low

    if (upMove > downMove && upMove > 0) {
      plusDM.push(upMove)
    } else {
      plusDM.push(0)
    }

    if (downMove > upMove && downMove > 0) {
      minusDM.push(downMove)
    } else {
      minusDM.push(0)
    }
  }

  const smoothTR: number[] = []
  const smoothPlusDM: number[] = []
  const smoothMinusDM: number[] = []

  let trSum = 0
  let plusDmSum = 0
  let minusDmSum = 0

  for (let i = 0; i < period - 1; i++) {
    trSum += tr[i]
    plusDmSum += plusDM[i]
    minusDmSum += minusDM[i]
    smoothTR.push(NaN)
    smoothPlusDM.push(NaN)
    smoothMinusDM.push(NaN)
  }

  trSum += tr[period - 1]
  plusDmSum += plusDM[period - 1]
  minusDmSum += minusDM[period - 1]

  smoothTR.push(trSum)
  smoothPlusDM.push(plusDmSum)
  smoothMinusDM.push(minusDmSum)

  for (let i = period; i < tr.length; i++) {
    const prevTR = smoothTR[i - 1]
    const prevPlusDM = smoothPlusDM[i - 1]
    const prevMinusDM = smoothMinusDM[i - 1]

    smoothTR.push(prevTR - prevTR / period + tr[i])
    smoothPlusDM.push(prevPlusDM - prevPlusDM / period + plusDM[i])
    smoothMinusDM.push(prevMinusDM - prevMinusDM / period + minusDM[i])
  }

  const dx: number[] = []
  for (let i = 0; i < smoothTR.length; i++) {
    const sTR = smoothTR[i]
    const sPlus = smoothPlusDM[i]
    const sMinus = smoothMinusDM[i]

    if (isNaN(sTR) || sTR === 0) {
      dx.push(NaN)
      plusDIValues.push(NaN)
      minusDIValues.push(NaN)
    } else {
      const pDI = (sPlus / sTR) * 100
      const mDI = (sMinus / sTR) * 100
      plusDIValues.push(pDI)
      minusDIValues.push(mDI)

      const sum = pDI + mDI
      const diff = Math.abs(pDI - mDI)
      dx.push(sum === 0 ? 0 : (diff / sum) * 100)
    }
  }

  const nonNaNDx = dx.filter((x) => !isNaN(x))
  if (nonNaNDx.length < period) {
    const empty = bars.map(() => NaN)
    return { adx: empty, plusDI: empty, minusDI: empty }
  }

  let dxSum = 0
  for (let i = 0; i < period; i++) {
    dxSum += nonNaNDx[i]
  }

  const rawAdx: number[] = []
  rawAdx.push(dxSum / period)

  for (let i = period; i < nonNaNDx.length; i++) {
    const prevADX = rawAdx[rawAdx.length - 1]
    rawAdx.push((prevADX * (period - 1) + nonNaNDx[i]) / period)
  }

  const paddingCount = 2 * period - 1
  let adxIdx = 0
  for (let i = 0; i < bars.length; i++) {
    if (i < paddingCount) {
      adxValues.push(NaN)
    } else {
      adxValues.push(rawAdx[adxIdx++])
    }
  }

  const finalPlusDI: number[] = []
  const finalMinusDI: number[] = []
  let diIdx = period - 1
  for (let i = 0; i < bars.length; i++) {
    if (i < period) {
      finalPlusDI.push(NaN)
      finalMinusDI.push(NaN)
    } else {
      finalPlusDI.push(plusDIValues[diIdx])
      finalMinusDI.push(minusDIValues[diIdx])
      diIdx++
    }
  }

  return { adx: adxValues, plusDI: finalPlusDI, minusDI: finalMinusDI }
}

const getActiveButtonStyle = (isActive: boolean, activeColor: string) => {
  if (!isActive) return {}
  return {
    color: activeColor,
    borderColor: activeColor,
    background: `${activeColor}1a`, // ~10% opacity in hex
    boxShadow: `0 0 6px ${activeColor}26`, // ~15% opacity in hex
  }
}

// ═══════════════════════════════════════════════════════
// Main PriceChart Component
// ═══════════════════════════════════════════════════════

export const PriceChart: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const rsiContainerRef = useRef<HTMLDivElement>(null)
  const macdContainerRef = useRef<HTMLDivElement>(null)
  const adxContainerRef = useRef<HTMLDivElement>(null)

  const chartRef = useRef<IChartApi | null>(null)
  const rsiChartRef = useRef<IChartApi | null>(null)
  const macdChartRef = useRef<IChartApi | null>(null)
  const adxChartRef = useRef<IChartApi | null>(null)

  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)

  // Overlay series refs
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbMiddleSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const ma9SeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const ma21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const ma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  // Sub-pane series refs
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const macdLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const macdSignalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const macdHistSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const adxSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const adxPlusDiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const adxMinusDiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  // Refs to track whether historical data has been set on series
  const vwapDataSetRef = useRef(false)
  const bbDataSetRef = useRef(false)
  const ma9DataSetRef = useRef(false)
  const ma21DataSetRef = useRef(false)
  const ma50DataSetRef = useRef(false)

  const rsiDataSetRef = useRef(false)
  const macdDataSetRef = useRef(false)
  const adxDataSetRef = useRef(false)
  const barsRef = useRef<any[]>([])
  const rsiDataRef = useRef<any[]>([])
  const macdDataRef = useRef<any[]>([])
  const adxDataRef = useRef<any[]>([])
  const [loadedSymbol, setLoadedSymbol] = useState<string | null>(null)
  const { activeSymbol } = useStore()

  // Toggles State
  const [showVwap, setShowVwap] = useState(() => localStorage.getItem('qs_chart_show_vwap') === 'true')
  const [showBb, setShowBb] = useState(() => localStorage.getItem('qs_chart_show_bb') === 'true')
  const [showMa9, setShowMa9] = useState(() => localStorage.getItem('qs_chart_show_ma9') === 'true')
  const [showMa21, setShowMa21] = useState(() => localStorage.getItem('qs_chart_show_ma21') === 'true')
  const [showMa50, setShowMa50] = useState(() => localStorage.getItem('qs_chart_show_ma50') === 'true')

  const [showRsi, setShowRsi] = useState(() => localStorage.getItem('qs_chart_show_rsi') === 'true')
  const [showMacd, setShowMacd] = useState(() => localStorage.getItem('qs_chart_show_macd') === 'true')
  const [showAdx, setShowAdx] = useState(() => localStorage.getItem('qs_chart_show_adx') === 'true')

  // Persist toggles to localStorage
  useEffect(() => {
    localStorage.setItem('qs_chart_show_vwap', String(showVwap))
    localStorage.setItem('qs_chart_show_bb', String(showBb))
    localStorage.setItem('qs_chart_show_ma9', String(showMa9))
    localStorage.setItem('qs_chart_show_ma21', String(showMa21))
    localStorage.setItem('qs_chart_show_ma50', String(showMa50))
    localStorage.setItem('qs_chart_show_rsi', String(showRsi))
    localStorage.setItem('qs_chart_show_macd', String(showMacd))
    localStorage.setItem('qs_chart_show_adx', String(showAdx))
  }, [showVwap, showBb, showMa9, showMa21, showMa50, showRsi, showMacd, showAdx])

  // ── 1. Initialize Main Chart & Fetch History ─────────────
  useEffect(() => {
    if (!chartContainerRef.current) return

    setLoadedSymbol(null)

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#10121a' },
        textColor: '#8f95a0',
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(28, 32, 48, 0.5)' },
        horzLines: { color: 'rgba(28, 32, 48, 0.5)' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(53, 127, 233, 0.4)', width: 1, style: 2 },
        horzLine: { color: 'rgba(53, 127, 233, 0.4)', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: '#202432',
        minimumWidth: 80,
      },
      timeScale: {
        borderColor: '#202432',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26d07c',
      downColor: '#f23645',
      borderUpColor: '#26d07c',
      borderDownColor: '#f23645',
      wickUpColor: '#26d07c',
      wickDownColor: '#f23645',
    })

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    const setLoadedData = (barsToSet: ChartDataManager.ChartBar[]) => {
      barsRef.current = barsToSet
      candleSeries.setData(barsToSet as any)
      const volumes = barsToSet.map((b) => ({
        time: b.time,
        value: b.volume,
        color: b.close >= b.open ? 'rgba(38, 208, 124, 0.3)' : 'rgba(242, 54, 69, 0.3)',
      }))
      volumeSeries.setData(volumes as any)
      setLoadedSymbol(activeSymbol)
    }

    const cachedStatus = ChartDataManager.getChartStatus(activeSymbol)
    if (cachedStatus === 'success') {
      console.log(`[PriceChart] Instant render from cache for ${activeSymbol}`)
      setLoadedData(ChartDataManager.getChartBars(activeSymbol))
    } else {
      ChartDataManager.setChartStatus(activeSymbol, 'loading')
      fetch(`http://localhost:8080/api/history/bars?symbol=${activeSymbol}&duration=1 D&barSize=1 min`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch historical bars')
          return res.json()
        })
        .then((data: any[]) => {
          if (Array.isArray(data) && data.length > 0) {
            const offsetMinutes = new Date().getTimezoneOffset()
            const offsetSeconds = offsetMinutes * 60

            const mappedBars = data.map((b: any) => ({
              time: Math.floor(new Date(b.barStart).getTime() / 1000) - offsetSeconds,
              open: b.open,
              high: b.high,
              low: b.low,
              close: b.close,
              volume: b.volume || 0,
            }))

            ChartDataManager.initChartBars(activeSymbol, mappedBars)
            setLoadedData(ChartDataManager.getChartBars(activeSymbol))
          }
        })
        .catch((err) => {
          console.warn('[PriceChart] Could not fetch historical bars, chart will start empty.', err)
          ChartDataManager.setChartStatus(activeSymbol, 'error')
        })
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const range = chart.timeScale().getVisibleLogicalRange()
        chart.applyOptions({ width, height })
        if (range) {
          chart.timeScale().setVisibleLogicalRange(range)
        }
      }
    })
    resizeObserver.observe(chartContainerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      setLoadedSymbol(null)

      if (rsiChartRef.current) {
        rsiChartRef.current.remove()
        rsiChartRef.current = null
      }
      if (macdChartRef.current) {
        macdChartRef.current.remove()
        macdChartRef.current = null
      }
      if (adxChartRef.current) {
        adxChartRef.current.remove()
        adxChartRef.current = null
      }

      // Reset all series references to prevent stale references on chart recreation
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      vwapSeriesRef.current = null
      bbUpperSeriesRef.current = null
      bbMiddleSeriesRef.current = null
      bbLowerSeriesRef.current = null
      ma9SeriesRef.current = null
      ma21SeriesRef.current = null
      ma50SeriesRef.current = null

      rsiSeriesRef.current = null
      macdLineSeriesRef.current = null
      macdSignalSeriesRef.current = null
      macdHistSeriesRef.current = null
      adxSeriesRef.current = null
      adxPlusDiSeriesRef.current = null
      adxMinusDiSeriesRef.current = null

      // Reset data-set tracking flags
      vwapDataSetRef.current = false
      bbDataSetRef.current = false
      ma9DataSetRef.current = false
      ma21DataSetRef.current = false
      ma50DataSetRef.current = false
      rsiDataSetRef.current = false
      macdDataSetRef.current = false
      adxDataSetRef.current = false
    }
  }, [activeSymbol])

  // ── 2. Stream Live Tick Data ──
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return

    const unsubscribe = ChartDataManager.registerChartTickListener(activeSymbol, (tick, updatedBar, isNewBar) => {
      if (!candleSeriesRef.current || !volumeSeriesRef.current) return

      candleSeriesRef.current.update(updatedBar as any)
      volumeSeriesRef.current.update({
        time: updatedBar.time,
        value: updatedBar.volume,
        color: updatedBar.close >= updatedBar.open ? 'rgba(38, 208, 124, 0.3)' : 'rgba(242, 54, 69, 0.3)',
      } as any)

      const currentBars = ChartDataManager.getChartBars(activeSymbol)
      barsRef.current = currentBars
      const lastTime = updatedBar.time
      const lastIdx = currentBars.length - 1

      // VWAP
      if (showVwap && vwapSeriesRef.current) {
        const vwapVals = calculateVWAP(currentBars)
        const val = vwapVals[lastIdx]
        if (!isNaN(val)) vwapSeriesRef.current.update({ time: lastTime as any, value: val })
      }

      // Bollinger Bands
      if (showBb && bbUpperSeriesRef.current && bbMiddleSeriesRef.current && bbLowerSeriesRef.current) {
        const closePrices = currentBars.map((b) => b.close)
        const { middle, upper, lower } = calculateBollingerBands(closePrices)
        const uVal = upper[lastIdx]
        const mVal = middle[lastIdx]
        const lVal = lower[lastIdx]
        if (!isNaN(uVal)) bbUpperSeriesRef.current.update({ time: lastTime as any, value: uVal })
        if (!isNaN(mVal)) bbMiddleSeriesRef.current.update({ time: lastTime as any, value: mVal })
        if (!isNaN(lVal)) bbLowerSeriesRef.current.update({ time: lastTime as any, value: lVal })
      }

      // EMA 9
      if (showMa9 && ma9SeriesRef.current) {
        const closePrices = currentBars.map((b) => b.close)
        const ema9 = calculateEMA(closePrices, 9)
        const val = ema9[lastIdx]
        if (!isNaN(val)) ma9SeriesRef.current.update({ time: lastTime as any, value: val })
      }

      // EMA 21
      if (showMa21 && ma21SeriesRef.current) {
        const closePrices = currentBars.map((b) => b.close)
        const ema21 = calculateEMA(closePrices, 21)
        const val = ema21[lastIdx]
        if (!isNaN(val)) ma21SeriesRef.current.update({ time: lastTime as any, value: val })
      }

      // EMA 50
      if (showMa50 && ma50SeriesRef.current) {
        const closePrices = currentBars.map((b) => b.close)
        const ema50 = calculateEMA(closePrices, 50)
        const val = ema50[lastIdx]
        if (!isNaN(val)) ma50SeriesRef.current.update({ time: lastTime as any, value: val })
      }

      // RSI
      if (showRsi && rsiSeriesRef.current) {
        const closePrices = currentBars.map((b) => b.close)
        const rsiVals = calculateRSI(closePrices, 14)
        const val = rsiVals[lastIdx]
        if (!isNaN(val)) {
          rsiSeriesRef.current.update({ time: lastTime as any, value: val })
          if (rsiDataRef.current.length > 0) {
            const last = rsiDataRef.current[rsiDataRef.current.length - 1]
            if (last.time === lastTime) {
              last.value = val
            } else {
              rsiDataRef.current.push({ time: lastTime, value: val })
            }
          }
        }
      }

      // MACD
      if (showMacd && macdLineSeriesRef.current && macdSignalSeriesRef.current && macdHistSeriesRef.current) {
        const closePrices = currentBars.map((b) => b.close)
        const { macdLine, signalLine, histogram } = calculateMACD(closePrices)
        const mlVal = macdLine[lastIdx]
        const msVal = signalLine[lastIdx]
        const hVal = histogram[lastIdx]
        if (!isNaN(mlVal)) {
          macdLineSeriesRef.current.update({ time: lastTime as any, value: mlVal })
          if (macdDataRef.current.length > 0) {
            const last = macdDataRef.current[macdDataRef.current.length - 1]
            if (last.time === lastTime) {
              last.value = mlVal
            } else {
              macdDataRef.current.push({ time: lastTime, value: mlVal })
            }
          }
        }
        if (!isNaN(msVal)) macdSignalSeriesRef.current.update({ time: lastTime as any, value: msVal })
        if (!isNaN(hVal)) {
          macdHistSeriesRef.current.update({
            time: lastTime as any,
            value: hVal,
            color: hVal >= 0 ? 'rgba(38, 208, 124, 0.5)' : 'rgba(242, 54, 69, 0.5)',
          })
        }
      }

      // ADX
      if (showAdx && adxSeriesRef.current && adxPlusDiSeriesRef.current && adxMinusDiSeriesRef.current) {
        const { adx: adxVals, plusDI, minusDI } = calculateADX(currentBars)
        const adxVal = adxVals[lastIdx]
        const plusDiVal = plusDI[lastIdx]
        const minusDiVal = minusDI[lastIdx]
        if (!isNaN(adxVal)) {
          adxSeriesRef.current.update({ time: lastTime as any, value: adxVal })
          if (adxDataRef.current.length > 0) {
            const last = adxDataRef.current[adxDataRef.current.length - 1]
            if (last.time === lastTime) {
              last.value = adxVal
            } else {
              adxDataRef.current.push({ time: lastTime, value: adxVal })
            }
          }
        }
        if (!isNaN(plusDiVal)) adxPlusDiSeriesRef.current.update({ time: lastTime as any, value: plusDiVal })
        if (!isNaN(minusDiVal)) adxMinusDiSeriesRef.current.update({ time: lastTime as any, value: minusDiVal })
      }
    })

    return () => unsubscribe()
  }, [activeSymbol, showVwap, showBb, showMa9, showMa21, showMa50, showRsi, showMacd, showAdx])

  // ── 3. Overlay Series (VWAP, Bollinger Bands, MAs) ──
  useEffect(() => {
    const chart = chartRef.current
    const currentBars = ChartDataManager.getChartBars(activeSymbol)
    if (!chart || currentBars.length === 0 || loadedSymbol !== activeSymbol) return

    // VWAP
    if (showVwap) {
      if (!vwapSeriesRef.current) {
        vwapSeriesRef.current = chart.addLineSeries({
          color: '#29b6f6',
          lineWidth: 2,
          title: 'VWAP',
        })
      }
      const vwapVals = calculateVWAP(currentBars)
      const lastIdx = currentBars.length - 1
      const lastTime = currentBars[lastIdx].time
      const lastVal = vwapVals[lastIdx]

      if (!vwapDataSetRef.current) {
        vwapSeriesRef.current.setData(currentBars.map((b, i) => ({ time: b.time, value: vwapVals[i] })).filter((d) => !isNaN(d.value)) as any)
        vwapDataSetRef.current = true
      } else if (!isNaN(lastVal)) {
        vwapSeriesRef.current.update({ time: lastTime as any, value: lastVal })
      }
    } else {
      if (vwapSeriesRef.current) {
        chart.removeSeries(vwapSeriesRef.current)
        vwapSeriesRef.current = null
      }
      vwapDataSetRef.current = false
    }

    // Bollinger Bands
    if (showBb) {
      if (!bbUpperSeriesRef.current) {
        bbUpperSeriesRef.current = chart.addLineSeries({ color: 'rgba(144, 98, 235, 0.7)', lineWidth: 1, title: 'BB Upper' })
        bbMiddleSeriesRef.current = chart.addLineSeries({ color: 'rgba(144, 98, 235, 0.4)', lineWidth: 1, lineStyle: 2, title: 'BB Middle' })
        bbLowerSeriesRef.current = chart.addLineSeries({ color: 'rgba(144, 98, 235, 0.7)', lineWidth: 1, title: 'BB Lower' })
      }
      const closePrices = currentBars.map((b) => b.close)
      const { middle, upper, lower } = calculateBollingerBands(closePrices)
      const lastIdx = currentBars.length - 1
      const lastTime = currentBars[lastIdx].time

      if (bbUpperSeriesRef.current && bbMiddleSeriesRef.current && bbLowerSeriesRef.current) {
        if (!bbDataSetRef.current) {
          bbUpperSeriesRef.current.setData(currentBars.map((b, i) => ({ time: b.time, value: upper[i] })).filter((d) => !isNaN(d.value)) as any)
          bbMiddleSeriesRef.current.setData(currentBars.map((b, i) => ({ time: b.time, value: middle[i] })).filter((d) => !isNaN(d.value)) as any)
          bbLowerSeriesRef.current.setData(currentBars.map((b, i) => ({ time: b.time, value: lower[i] })).filter((d) => !isNaN(d.value)) as any)
          bbDataSetRef.current = true
        } else {
          const uVal = upper[lastIdx]
          const mVal = middle[lastIdx]
          const lVal = lower[lastIdx]
          if (!isNaN(uVal)) bbUpperSeriesRef.current.update({ time: lastTime as any, value: uVal })
          if (!isNaN(mVal)) bbMiddleSeriesRef.current.update({ time: lastTime as any, value: mVal })
          if (!isNaN(lVal)) bbLowerSeriesRef.current.update({ time: lastTime as any, value: lVal })
        }
      }
    } else {
      if (bbUpperSeriesRef.current) {
        chart.removeSeries(bbUpperSeriesRef.current)
        if (bbMiddleSeriesRef.current) chart.removeSeries(bbMiddleSeriesRef.current)
        if (bbLowerSeriesRef.current) chart.removeSeries(bbLowerSeriesRef.current)
        bbUpperSeriesRef.current = null
        bbMiddleSeriesRef.current = null
        bbLowerSeriesRef.current = null
      }
      bbDataSetRef.current = false
    }

    // MA 9
    if (showMa9) {
      if (!ma9SeriesRef.current) {
        ma9SeriesRef.current = chart.addLineSeries({ color: '#e5b83b', lineWidth: 1, title: 'EMA 9' })
      }
      const closePrices = currentBars.map((b) => b.close)
      const ema9 = calculateEMA(closePrices, 9)
      const lastIdx = currentBars.length - 1
      const lastTime = currentBars[lastIdx].time
      const lastVal = ema9[lastIdx]

      if (!ma9DataSetRef.current) {
        ma9SeriesRef.current.setData(currentBars.map((b, i) => ({ time: b.time, value: ema9[i] })).filter((d) => !isNaN(d.value)) as any)
        ma9DataSetRef.current = true
      } else if (!isNaN(lastVal)) {
        ma9SeriesRef.current.update({ time: lastTime as any, value: lastVal })
      }
    } else {
      if (ma9SeriesRef.current) {
        chart.removeSeries(ma9SeriesRef.current)
        ma9SeriesRef.current = null
      }
      ma9DataSetRef.current = false
    }

    // MA 21
    if (showMa21) {
      if (!ma21SeriesRef.current) {
        ma21SeriesRef.current = chart.addLineSeries({ color: '#ff7043', lineWidth: 1, title: 'EMA 21' })
      }
      const closePrices = currentBars.map((b) => b.close)
      const ema21 = calculateEMA(closePrices, 21)
      const lastIdx = currentBars.length - 1
      const lastTime = currentBars[lastIdx].time
      const lastVal = ema21[lastIdx]

      if (!ma21DataSetRef.current) {
        ma21SeriesRef.current.setData(currentBars.map((b, i) => ({ time: b.time, value: ema21[i] })).filter((d) => !isNaN(d.value)) as any)
        ma21DataSetRef.current = true
      } else if (!isNaN(lastVal)) {
        ma21SeriesRef.current.update({ time: lastTime as any, value: lastVal })
      }
    } else {
      if (ma21SeriesRef.current) {
        chart.removeSeries(ma21SeriesRef.current)
        ma21SeriesRef.current = null
      }
      ma21DataSetRef.current = false
    }

    // MA 50
    if (showMa50) {
      if (!ma50SeriesRef.current) {
        ma50SeriesRef.current = chart.addLineSeries({ color: '#ff3d00', lineWidth: 1, title: 'EMA 50' })
      }
      const closePrices = currentBars.map((b) => b.close)
      const ema50 = calculateEMA(closePrices, 50)
      const lastIdx = currentBars.length - 1
      const lastTime = currentBars[lastIdx].time
      const lastVal = ema50[lastIdx]

      if (!ma50DataSetRef.current) {
        ma50SeriesRef.current.setData(currentBars.map((b, i) => ({ time: b.time, value: ema50[i] })).filter((d) => !isNaN(d.value)) as any)
        ma50DataSetRef.current = true
      } else if (!isNaN(lastVal)) {
        ma50SeriesRef.current.update({ time: lastTime as any, value: lastVal })
      }
    } else {
      if (ma50SeriesRef.current) {
        chart.removeSeries(ma50SeriesRef.current)
        ma50SeriesRef.current = null
      }
      ma50DataSetRef.current = false
    }
  }, [loadedSymbol, showVwap, showBb, showMa9, showMa21, showMa50, activeSymbol])

  // ── 4a. Initialize RSI Chart ───────────────────────
  useEffect(() => {
    if (!showRsi) {
      if (rsiChartRef.current) {
        rsiChartRef.current.remove()
        rsiChartRef.current = null
        rsiSeriesRef.current = null
      }
      return
    }

    if (!rsiContainerRef.current) return

    const newChart = createChart(rsiContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#10121a' },
        textColor: '#8f95a0',
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(28, 32, 48, 0.4)' },
        horzLines: { color: 'rgba(28, 32, 48, 0.4)' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(53, 127, 233, 0.4)', width: 1, style: 2 },
        horzLine: { color: 'rgba(53, 127, 233, 0.4)', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: '#202432',
        minimumWidth: 80,
      },
      timeScale: {
        visible: false,
        borderColor: '#202432',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    })

    const rsiSeries = newChart.addLineSeries({
      color: '#9062eb',
      lineWidth: 2,
      title: 'RSI(14)',
    })

    rsiSeries.createPriceLine({
      price: 70,
      color: 'rgba(242, 54, 69, 0.4)',
      lineWidth: 1,
      lineStyle: 3,
      axisLabelVisible: true,
      title: 'OB',
    })
    rsiSeries.createPriceLine({
      price: 30,
      color: 'rgba(38, 208, 124, 0.4)',
      lineWidth: 1,
      lineStyle: 3,
      axisLabelVisible: true,
      title: 'OS',
    })

    rsiChartRef.current = newChart
    rsiSeriesRef.current = rsiSeries

    const currentBars = ChartDataManager.getChartBars(activeSymbol)
    if (loadedSymbol === activeSymbol && currentBars.length > 0) {
      const closePrices = currentBars.map((b) => b.close)
      const rsiVals = calculateRSI(closePrices, 14)
      const rsiData = currentBars.map((b, i) => {
        const val = rsiVals[i]
        return isNaN(val) ? { time: b.time } : { time: b.time, value: val }
      })
      rsiDataRef.current = rsiData
      rsiSeries.setData(rsiData as any)
      rsiDataSetRef.current = true
    }

    const mainRange = chartRef.current?.timeScale().getVisibleLogicalRange()
    if (mainRange) {
      newChart.timeScale().setVisibleLogicalRange(mainRange)
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const range = newChart.timeScale().getVisibleLogicalRange()
        newChart.applyOptions({ width, height })
        if (range) {
          newChart.timeScale().setVisibleLogicalRange(range)
        }
      }
    })
    resizeObserver.observe(rsiContainerRef.current)

    return () => {
      resizeObserver.disconnect()
      if (rsiChartRef.current) {
        rsiChartRef.current.remove()
        rsiChartRef.current = null
        rsiSeriesRef.current = null
      }
      rsiDataSetRef.current = false
    }
  }, [showRsi, loadedSymbol])

  // ── 5a. Initialize MACD Chart ──────────────────────
  useEffect(() => {
    if (!showMacd) {
      if (macdChartRef.current) {
        macdChartRef.current.remove()
        macdChartRef.current = null
        macdLineSeriesRef.current = null
        macdSignalSeriesRef.current = null
        macdHistSeriesRef.current = null
      }
      return
    }

    if (!macdContainerRef.current) return

    const newChart = createChart(macdContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#10121a' },
        textColor: '#8f95a0',
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(28, 32, 48, 0.4)' },
        horzLines: { color: 'rgba(28, 32, 48, 0.4)' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(53, 127, 233, 0.4)', width: 1, style: 2 },
        horzLine: { color: 'rgba(53, 127, 233, 0.4)', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: '#202432',
        minimumWidth: 80,
      },
      timeScale: {
        visible: false,
        borderColor: '#202432',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    })

    const macdLineSeries = newChart.addLineSeries({ color: '#29b6f6', lineWidth: 1, title: 'MACD' })
    const macdSignalSeries = newChart.addLineSeries({ color: '#ff7043', lineWidth: 1, title: 'Signal' })
    const macdHistSeries = newChart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'macdVolume',
    })
    newChart.priceScale('macdVolume').applyOptions({
      scaleMargins: { top: 0.6, bottom: 0.1 },
    })

    macdChartRef.current = newChart
    macdLineSeriesRef.current = macdLineSeries
    macdSignalSeriesRef.current = macdSignalSeries
    macdHistSeriesRef.current = macdHistSeries

    const currentBars = ChartDataManager.getChartBars(activeSymbol)
    if (loadedSymbol === activeSymbol && currentBars.length > 0) {
      const closePrices = currentBars.map((b) => b.close)
      const { macdLine, signalLine, histogram } = calculateMACD(closePrices)
      const macdData = currentBars.map((b, i) => {
        const val = macdLine[i]
        return isNaN(val) ? { time: b.time } : { time: b.time, value: val }
      })
      macdDataRef.current = macdData
      macdLineSeries.setData(macdData as any)
      macdSignalSeries.setData(
        currentBars.map((b, i) => {
          const val = signalLine[i]
          return isNaN(val) ? { time: b.time } : { time: b.time, value: val }
        }) as any
      )
      macdHistSeries.setData(
        currentBars.map((b, i) => {
          const val = histogram[i]
          return isNaN(val)
            ? { time: b.time }
            : {
                time: b.time,
                value: val,
                color: val >= 0 ? 'rgba(38, 208, 124, 0.5)' : 'rgba(242, 54, 69, 0.5)',
              }
        }) as any
      )
      macdDataSetRef.current = true
    }

    const mainRange = chartRef.current?.timeScale().getVisibleLogicalRange()
    if (mainRange) {
      newChart.timeScale().setVisibleLogicalRange(mainRange)
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const range = newChart.timeScale().getVisibleLogicalRange()
        newChart.applyOptions({ width, height })
        if (range) {
          newChart.timeScale().setVisibleLogicalRange(range)
        }
      }
    })
    resizeObserver.observe(macdContainerRef.current)

    return () => {
      resizeObserver.disconnect()
      if (macdChartRef.current) {
        macdChartRef.current.remove()
        macdChartRef.current = null
        macdLineSeriesRef.current = null
        macdSignalSeriesRef.current = null
        macdHistSeriesRef.current = null
      }
      macdDataSetRef.current = false
    }
  }, [showMacd, loadedSymbol])

  // ── 6a. Initialize ADX Chart ───────────────────────
  useEffect(() => {
    if (!showAdx) {
      if (adxChartRef.current) {
        adxChartRef.current.remove()
        adxChartRef.current = null
        adxSeriesRef.current = null
        adxPlusDiSeriesRef.current = null
        adxMinusDiSeriesRef.current = null
      }
      return
    }

    if (!adxContainerRef.current) return

    const newChart = createChart(adxContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#10121a' },
        textColor: '#8f95a0',
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(28, 32, 48, 0.4)' },
        horzLines: { color: 'rgba(28, 32, 48, 0.4)' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(53, 127, 233, 0.4)', width: 1, style: 2 },
        horzLine: { color: 'rgba(53, 127, 233, 0.4)', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: '#202432',
        minimumWidth: 80,
      },
      timeScale: {
        visible: true,
        borderColor: '#202432',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    })

    const adxSeries = newChart.addLineSeries({ color: '#ffca28', lineWidth: 2, title: 'ADX' })
    const adxPlusDiSeries = newChart.addLineSeries({ color: 'rgba(38, 208, 124, 0.6)', lineWidth: 1, title: '+DI' })
    const adxMinusDiSeries = newChart.addLineSeries({ color: 'rgba(242, 54, 69, 0.6)', lineWidth: 1, title: '-DI' })

    adxChartRef.current = newChart
    adxSeriesRef.current = adxSeries
    adxPlusDiSeriesRef.current = adxPlusDiSeries
    adxMinusDiSeriesRef.current = adxMinusDiSeries

    const currentBars = ChartDataManager.getChartBars(activeSymbol)
    if (loadedSymbol === activeSymbol && currentBars.length > 0) {
      const { adx: adxVals, plusDI, minusDI } = calculateADX(currentBars)
      const adxData = currentBars.map((b, i) => {
        const val = adxVals[i]
        return isNaN(val) ? { time: b.time } : { time: b.time, value: val }
      })
      adxDataRef.current = adxData
      adxSeries.setData(adxData as any)
      adxPlusDiSeries.setData(
        currentBars.map((b, i) => {
          const val = plusDI[i]
          return isNaN(val) ? { time: b.time } : { time: b.time, value: val }
        }) as any
      )
      adxMinusDiSeries.setData(
        currentBars.map((b, i) => {
          const val = minusDI[i]
          return isNaN(val) ? { time: b.time } : { time: b.time, value: val }
        }) as any
      )
      adxDataSetRef.current = true
    }

    const mainRange = chartRef.current?.timeScale().getVisibleLogicalRange()
    if (mainRange) {
      newChart.timeScale().setVisibleLogicalRange(mainRange)
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const range = newChart.timeScale().getVisibleLogicalRange()
        newChart.applyOptions({ width, height })
        if (range) {
          newChart.timeScale().setVisibleLogicalRange(range)
        }
      }
    })
    resizeObserver.observe(adxContainerRef.current)

    return () => {
      resizeObserver.disconnect()
      if (adxChartRef.current) {
        adxChartRef.current.remove()
        adxChartRef.current = null
        adxSeriesRef.current = null
        adxPlusDiSeriesRef.current = null
        adxMinusDiSeriesRef.current = null
      }
      adxDataSetRef.current = false
    }
  }, [showAdx, loadedSymbol])

  // ── 7. Time Scale & Crosshair Synchronization Loop ───────────
  useEffect(() => {
    const active = [
      { chart: chartRef.current, series: candleSeriesRef.current, dataRef: barsRef, show: true },
      { chart: rsiChartRef.current, series: rsiSeriesRef.current, dataRef: rsiDataRef, show: showRsi },
      { chart: macdChartRef.current, series: macdLineSeriesRef.current, dataRef: macdDataRef, show: showMacd },
      { chart: adxChartRef.current, series: adxSeriesRef.current, dataRef: adxDataRef, show: showAdx },
    ].filter((item) => item.chart && item.series && item.show)

    if (active.length === 0) return

    // Hide time axis duplication except on bottom-most visible pane
    active.forEach((item, index) => {
      const isBottom = index === active.length - 1
      item.chart!.timeScale().applyOptions({ visible: isBottom })
    })

    if (active.length < 2) return

    const unsubs: (() => void)[] = []

    active.forEach((item, index) => {
      const currentChart = item.chart!
      const otherCharts = active.filter((_, idx) => idx !== index)

      // 7.1 Sync visible logical range (scroll / zoom)
      const rangeListener = (range: any) => {
        otherCharts.forEach((other) => {
          if (other.chart) {
            const currentRange = other.chart.timeScale().getVisibleLogicalRange()
            if (!currentRange || currentRange.from !== range.from || currentRange.to !== range.to) {
              other.chart.timeScale().setVisibleLogicalRange(range)
            }
          }
        })
      }

      currentChart.timeScale().subscribeVisibleLogicalRangeChange(rangeListener)
      unsubs.push(() => {
        currentChart.timeScale().unsubscribeVisibleLogicalRangeChange(rangeListener)
      })

      // 7.2 Sync crosshair move (hover markers / lines)
      const crosshairListener = (param: any) => {
        // Prevent feedback loops: only sync if movement was initiated by user mouse/touch
        if (!param.sourceEvent) return

        if (!param.time) {
          otherCharts.forEach((other) => {
            other.chart!.clearCrosshairPosition()
          })
          return
        }

        otherCharts.forEach((other) => {
          if (other.chart && other.series && other.dataRef) {
            // Find data point at current param.time
            const dataArray = other.dataRef.current
            const dataPoint = dataArray.find((d: any) => d.time === param.time)

            if (dataPoint) {
              const price = dataPoint.close !== undefined ? dataPoint.close : dataPoint.value
              if (price !== undefined) {
                other.chart.setCrosshairPosition(price, param.time, other.series)
              }
            } else {
              other.chart.clearCrosshairPosition()
            }
          }
        })
      }

      currentChart.subscribeCrosshairMove(crosshairListener)
      unsubs.push(() => {
        currentChart.unsubscribeCrosshairMove(crosshairListener)
      })
    })

    return () => {
      unsubs.forEach((unsub) => unsub())
    }
  }, [showRsi, showMacd, showAdx, activeSymbol, loadedSymbol])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#10121a' }}>
      {/* Toggle Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px var(--qs-gap-md)',
          borderBottom: '1px solid var(--qs-border)',
          background: 'var(--qs-bg-primary)',
          gap: 'var(--qs-gap-sm)',
          flexWrap: 'wrap',
        }}
      >
        {/* Overlays Group */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '10px',
              color: 'var(--qs-text-muted)',
              textTransform: 'uppercase',
              marginRight: '4px',
              fontWeight: 600,
            }}
          >
            Overlays:
          </span>
          <button
            onClick={() => setShowVwap(!showVwap)}
            className={`btn-indicator ${showVwap ? 'btn-indicator--active' : ''}`}
            style={getActiveButtonStyle(showVwap, '#29b6f6')}
          >
            VWAP
          </button>
          <button
            onClick={() => setShowBb(!showBb)}
            className={`btn-indicator ${showBb ? 'btn-indicator--active' : ''}`}
            style={getActiveButtonStyle(showBb, '#9062eb')}
          >
            Bollinger
          </button>
          <button
            onClick={() => setShowMa9(!showMa9)}
            className={`btn-indicator ${showMa9 ? 'btn-indicator--active' : ''}`}
            style={getActiveButtonStyle(showMa9, '#e5b83b')}
          >
            MA 9
          </button>
          <button
            onClick={() => setShowMa21(!showMa21)}
            className={`btn-indicator ${showMa21 ? 'btn-indicator--active' : ''}`}
            style={getActiveButtonStyle(showMa21, '#ff7043')}
          >
            MA 21
          </button>
          <button
            onClick={() => setShowMa50(!showMa50)}
            className={`btn-indicator ${showMa50 ? 'btn-indicator--active' : ''}`}
            style={getActiveButtonStyle(showMa50, '#ff3d00')}
          >
            MA 50
          </button>
        </div>
        {/* Indicator Panes Group */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '10px',
              color: 'var(--qs-text-muted)',
              textTransform: 'uppercase',
              marginRight: '4px',
              fontWeight: 600,
            }}
          >
            Panes:
          </span>
          <button
            onClick={() => setShowRsi(!showRsi)}
            className={`btn-indicator ${showRsi ? 'btn-indicator--active' : ''}`}
            style={getActiveButtonStyle(showRsi, '#9062eb')}
          >
            RSI
          </button>
          <button
            onClick={() => setShowMacd(!showMacd)}
            className={`btn-indicator ${showMacd ? 'btn-indicator--active' : ''}`}
            style={getActiveButtonStyle(showMacd, '#29b6f6')}
          >
            MACD
          </button>
          <button
            onClick={() => setShowAdx(!showAdx)}
            className={`btn-indicator ${showAdx ? 'btn-indicator--active' : ''}`}
            style={getActiveButtonStyle(showAdx, '#ffca28')}
          >
            ADX
          </button>
        </div>
      </div>

      {/* Charts Stack */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Main Price Chart */}
        <div ref={chartContainerRef} style={{ flex: 3, minHeight: '150px', width: '100%', position: 'relative' }} />

        {/* RSI Pane */}
        {showRsi && (
          <div
            ref={rsiContainerRef}
            style={{ flex: 1, minHeight: '80px', width: '100%', borderTop: '1px solid var(--qs-border)' }}
          />
        )}

        {/* MACD Pane */}
        {showMacd && (
          <div
            ref={macdContainerRef}
            style={{ flex: 1, minHeight: '80px', width: '100%', borderTop: '1px solid var(--qs-border)' }}
          />
        )}

        {/* ADX Pane */}
        {showAdx && (
          <div
            ref={adxContainerRef}
            style={{ flex: 1, minHeight: '80px', width: '100%', borderTop: '1px solid var(--qs-border)' }}
          />
        )}
      </div>
    </div>
  )
}
