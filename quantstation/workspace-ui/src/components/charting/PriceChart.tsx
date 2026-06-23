import React, { useEffect, useRef, useState } from 'react'
import { createChart, type IChartApi, type ISeriesApi, ColorType } from 'lightweight-charts'
import { useStore } from '../../store/useStore'

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
    const date = new Date(bar.time * 1000)
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

  const { activeSymbol } = useStore()
  const tick = useStore((state) => state.ticks[activeSymbol])

  // Bars State (Historical + Streaming)
  const [bars, setBars] = useState<any[]>([])
  const currentBarRef = useRef<any | null>(null)

  // Toggles State
  const [showVwap, setShowVwap] = useState(false)
  const [showBb, setShowBb] = useState(false)
  const [showMa9, setShowMa9] = useState(false)
  const [showMa21, setShowMa21] = useState(false)
  const [showMa50, setShowMa50] = useState(false)

  const [showRsi, setShowRsi] = useState(false)
  const [showMacd, setShowMacd] = useState(false)
  const [showAdx, setShowAdx] = useState(false)

  // ── 1. Initialize Main Chart & Fetch History ─────────────
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#10121a' },
        textColor: '#8f95a0',
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: 11,
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

    fetch(`http://localhost:8080/api/history/bars?symbol=${activeSymbol}&duration=1 D&barSize=1 min`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch historical bars')
        return res.json()
      })
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const mappedBars = data.map((b: any) => ({
            time: Math.floor(new Date(b.barStart).getTime() / 1000),
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
            volume: b.volume || 0,
          }))

          setBars(mappedBars)
          candleSeries.setData(mappedBars as any)

          const volumes = data.map((b: any) => ({
            time: Math.floor(new Date(b.barStart).getTime() / 1000),
            value: b.volume || 0,
            color: b.close >= b.open ? 'rgba(38, 208, 124, 0.3)' : 'rgba(242, 54, 69, 0.3)',
          }))
          volumeSeries.setData(volumes as any)

          const lastBar = data[data.length - 1]
          currentBarRef.current = {
            time: Math.floor(new Date(lastBar.barStart).getTime() / 1000),
            open: lastBar.open,
            high: lastBar.high,
            low: lastBar.low,
            close: lastBar.close,
            volume: lastBar.volume || 0,
          }
        }
      })
      .catch((err) => {
        console.warn('[PriceChart] Could not fetch historical bars, chart will start empty.', err)
      })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        chart.applyOptions({ width, height })
      }
    })
    resizeObserver.observe(chartContainerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      currentBarRef.current = null

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
    }
  }, [activeSymbol])

  // ── 2. Stream Live Tick Data into Current Minute Bar ──
  useEffect(() => {
    if (!tick || !candleSeriesRef.current || !volumeSeriesRef.current) return

    const time = Math.floor(new Date(tick.timestamp).getTime() / 1000)
    const roundedTime = Math.floor(time / 60) * 60

    const lastBar = currentBarRef.current

    if (lastBar && lastBar.time === roundedTime) {
      lastBar.high = Math.max(lastBar.high, tick.price)
      lastBar.low = Math.min(lastBar.low, tick.price)
      lastBar.close = tick.price
      lastBar.volume += tick.size
    } else {
      currentBarRef.current = {
        time: roundedTime,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.size,
      }
    }

    const current = currentBarRef.current
    if (current) {
      candleSeriesRef.current.update({
        time: current.time,
        open: current.open,
        high: current.high,
        low: current.low,
        close: current.close,
      } as any)

      volumeSeriesRef.current.update({
        time: current.time,
        value: current.volume,
        color: current.close >= current.open ? 'rgba(38, 208, 124, 0.3)' : 'rgba(242, 54, 69, 0.3)',
      } as any)
    }

    setBars((prevBars) => {
      if (prevBars.length === 0) return prevBars
      const updated = [...prevBars]
      const last = updated[updated.length - 1]
      if (last.time === roundedTime) {
        last.high = Math.max(last.high, tick.price)
        last.low = Math.min(last.low, tick.price)
        last.close = tick.price
        last.volume += tick.size
      } else {
        updated.push({
          time: roundedTime,
          open: tick.price,
          high: tick.price,
          low: tick.price,
          close: tick.price,
          volume: tick.size,
        })
      }
      return updated
    })
  }, [tick])

  // ── 3. Overlay Series (VWAP, Bollinger Bands, MAs) ──
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || bars.length === 0) return

    // VWAP
    if (showVwap) {
      if (!vwapSeriesRef.current) {
        vwapSeriesRef.current = chart.addLineSeries({
          color: '#29b6f6',
          lineWidth: 2,
          title: 'VWAP',
        })
      }
      const vwapVals = calculateVWAP(bars)
      vwapSeriesRef.current.setData(bars.map((b, i) => ({ time: b.time, value: vwapVals[i] })).filter((d) => !isNaN(d.value)))
    } else {
      if (vwapSeriesRef.current) {
        chart.removeSeries(vwapSeriesRef.current)
        vwapSeriesRef.current = null
      }
    }

    // Bollinger Bands
    if (showBb) {
      if (!bbUpperSeriesRef.current) {
        bbUpperSeriesRef.current = chart.addLineSeries({ color: 'rgba(144, 98, 235, 0.7)', lineWidth: 1, title: 'BB Upper' })
        bbMiddleSeriesRef.current = chart.addLineSeries({ color: 'rgba(144, 98, 235, 0.4)', lineWidth: 1, lineStyle: 2, title: 'BB Middle' })
        bbLowerSeriesRef.current = chart.addLineSeries({ color: 'rgba(144, 98, 235, 0.7)', lineWidth: 1, title: 'BB Lower' })
      }
      const closePrices = bars.map((b) => b.close)
      const { middle, upper, lower } = calculateBollingerBands(closePrices)

      if (bbUpperSeriesRef.current && bbMiddleSeriesRef.current && bbLowerSeriesRef.current) {
        bbUpperSeriesRef.current.setData(bars.map((b, i) => ({ time: b.time, value: upper[i] })).filter((d) => !isNaN(d.value)))
        bbMiddleSeriesRef.current.setData(bars.map((b, i) => ({ time: b.time, value: middle[i] })).filter((d) => !isNaN(d.value)))
        bbLowerSeriesRef.current.setData(bars.map((b, i) => ({ time: b.time, value: lower[i] })).filter((d) => !isNaN(d.value)))
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
    }

    // MA 9
    if (showMa9) {
      if (!ma9SeriesRef.current) {
        ma9SeriesRef.current = chart.addLineSeries({ color: '#e5b83b', lineWidth: 1, title: 'EMA 9' })
      }
      const closePrices = bars.map((b) => b.close)
      const ema9 = calculateEMA(closePrices, 9)
      ma9SeriesRef.current.setData(bars.map((b, i) => ({ time: b.time, value: ema9[i] })).filter((d) => !isNaN(d.value)))
    } else {
      if (ma9SeriesRef.current) {
        chart.removeSeries(ma9SeriesRef.current)
        ma9SeriesRef.current = null
      }
    }

    // MA 21
    if (showMa21) {
      if (!ma21SeriesRef.current) {
        ma21SeriesRef.current = chart.addLineSeries({ color: '#ff7043', lineWidth: 1, title: 'EMA 21' })
      }
      const closePrices = bars.map((b) => b.close)
      const ema21 = calculateEMA(closePrices, 21)
      ma21SeriesRef.current.setData(bars.map((b, i) => ({ time: b.time, value: ema21[i] })).filter((d) => !isNaN(d.value)))
    } else {
      if (ma21SeriesRef.current) {
        chart.removeSeries(ma21SeriesRef.current)
        ma21SeriesRef.current = null
      }
    }

    // MA 50
    if (showMa50) {
      if (!ma50SeriesRef.current) {
        ma50SeriesRef.current = chart.addLineSeries({ color: '#ff3d00', lineWidth: 1, title: 'EMA 50' })
      }
      const closePrices = bars.map((b) => b.close)
      const ema50 = calculateEMA(closePrices, 50)
      ma50SeriesRef.current.setData(bars.map((b, i) => ({ time: b.time, value: ema50[i] })).filter((d) => !isNaN(d.value)))
    } else {
      if (ma50SeriesRef.current) {
        chart.removeSeries(ma50SeriesRef.current)
        ma50SeriesRef.current = null
      }
    }
  }, [bars, showVwap, showBb, showMa9, showMa21, showMa50])

  // ── 4. Sub-pane: RSI Chart ───────────────────────
  useEffect(() => {
    if (!showRsi || bars.length === 0) {
      if (rsiChartRef.current) {
        rsiChartRef.current.remove()
        rsiChartRef.current = null
        rsiSeriesRef.current = null
      }
      return
    }

    if (!rsiContainerRef.current) return

    let rsiChart = rsiChartRef.current
    if (!rsiChart) {
      const newChart = createChart(rsiContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#10121a' },
          textColor: '#8f95a0',
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: 10,
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
        },
        timeScale: {
          visible: false,
          borderColor: '#202432',
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
      rsiChart = newChart

      const mainRange = chartRef.current?.timeScale().getVisibleLogicalRange()
      if (mainRange) {
        newChart.timeScale().setVisibleLogicalRange(mainRange)
      }

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          newChart.applyOptions({ width, height })
        }
      })
      resizeObserver.observe(rsiContainerRef.current)

      return () => {
        resizeObserver.disconnect()
      }
    }

    const closePrices = bars.map((b) => b.close)
    const rsiVals = calculateRSI(closePrices, 14)
    if (rsiSeriesRef.current) {
      rsiSeriesRef.current.setData(bars.map((b, i) => ({ time: b.time, value: rsiVals[i] })).filter((d) => !isNaN(d.value)))
    }
  }, [bars, showRsi])

  // ── 5. Sub-pane: MACD Chart ──────────────────────
  useEffect(() => {
    if (!showMacd || bars.length === 0) {
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

    let macdChart = macdChartRef.current
    if (!macdChart) {
      const newChart = createChart(macdContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#10121a' },
          textColor: '#8f95a0',
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: 10,
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
        },
        timeScale: {
          visible: false,
          borderColor: '#202432',
        },
        handleScroll: { vertTouchDrag: false },
      })

      const macdLineSeries = newChart.addLineSeries({ color: '#29b6f6', lineWidth: 1, title: 'MACD' })
      const macdSignalSeries = newChart.addLineSeries({ color: '#ff7043', lineWidth: 1, title: 'Signal' })
      const macdHistSeries = newChart.addHistogramSeries({
        priceFormat: { type: 'volume' },
      })

      macdChartRef.current = newChart
      macdLineSeriesRef.current = macdLineSeries
      macdSignalSeriesRef.current = macdSignalSeries
      macdHistSeriesRef.current = macdHistSeries
      macdChart = newChart

      const mainRange = chartRef.current?.timeScale().getVisibleLogicalRange()
      if (mainRange) {
        newChart.timeScale().setVisibleLogicalRange(mainRange)
      }

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          newChart.applyOptions({ width, height })
        }
      })
      resizeObserver.observe(macdContainerRef.current)

      return () => {
        resizeObserver.disconnect()
      }
    }

    const closePrices = bars.map((b) => b.close)
    const { macdLine, signalLine, histogram } = calculateMACD(closePrices)

    if (macdLineSeriesRef.current && macdSignalSeriesRef.current && macdHistSeriesRef.current) {
      macdLineSeriesRef.current.setData(bars.map((b, i) => ({ time: b.time, value: macdLine[i] })).filter((d) => !isNaN(d.value)))
      macdSignalSeriesRef.current.setData(bars.map((b, i) => ({ time: b.time, value: signalLine[i] })).filter((d) => !isNaN(d.value)))
      macdHistSeriesRef.current.setData(
        bars
          .map((b, i) => ({
            time: b.time,
            value: histogram[i],
            color: histogram[i] >= 0 ? 'rgba(38, 208, 124, 0.5)' : 'rgba(242, 54, 69, 0.5)',
          }))
          .filter((d) => !isNaN(d.value))
      )
    }
  }, [bars, showMacd])

  // ── 6. Sub-pane: ADX Chart ───────────────────────
  useEffect(() => {
    if (!showAdx || bars.length === 0) {
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

    let adxChart = adxChartRef.current
    if (!adxChart) {
      const newChart = createChart(adxContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#10121a' },
          textColor: '#8f95a0',
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: 10,
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
        },
        timeScale: {
          visible: true,
          borderColor: '#202432',
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
      adxChart = newChart

      const mainRange = chartRef.current?.timeScale().getVisibleLogicalRange()
      if (mainRange) {
        newChart.timeScale().setVisibleLogicalRange(mainRange)
      }

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          newChart.applyOptions({ width, height })
        }
      })
      resizeObserver.observe(adxContainerRef.current)

      return () => {
        resizeObserver.disconnect()
      }
    }

    const { adx: adxVals, plusDI, minusDI } = calculateADX(bars)

    if (adxSeriesRef.current && adxPlusDiSeriesRef.current && adxMinusDiSeriesRef.current) {
      adxSeriesRef.current.setData(bars.map((b, i) => ({ time: b.time, value: adxVals[i] })).filter((d) => !isNaN(d.value)))
      adxPlusDiSeriesRef.current.setData(bars.map((b, i) => ({ time: b.time, value: plusDI[i] })).filter((d) => !isNaN(d.value)))
      adxMinusDiSeriesRef.current.setData(bars.map((b, i) => ({ time: b.time, value: minusDI[i] })).filter((d) => !isNaN(d.value)))
    }
  }, [bars, showAdx])

  // ── 7. Time Scale Synchronization Loop ───────────
  useEffect(() => {
    const active = [
      { chart: chartRef.current, show: true },
      { chart: rsiChartRef.current, show: showRsi },
      { chart: macdChartRef.current, show: showMacd },
      { chart: adxChartRef.current, show: showAdx },
    ].filter((item) => item.chart && item.show)

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
      const otherCharts = active.filter((_, idx) => idx !== index).map((o) => o.chart!)

      const listener = (range: any) => {
        otherCharts.forEach((otherChart) => {
          if (otherChart) {
            const currentRange = otherChart.timeScale().getVisibleLogicalRange()
            if (!currentRange || currentRange.from !== range.from || currentRange.to !== range.to) {
              otherChart.timeScale().setVisibleLogicalRange(range)
            }
          }
        })
      }

      currentChart.timeScale().subscribeVisibleLogicalRangeChange(listener)
      unsubs.push(() => {
        currentChart.timeScale().unsubscribeVisibleLogicalRangeChange(listener)
      })
    })

    return () => {
      unsubs.forEach((unsub) => unsub())
    }
  }, [bars, showRsi, showMacd, showAdx])

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
          >
            VWAP
          </button>
          <button
            onClick={() => setShowBb(!showBb)}
            className={`btn-indicator ${showBb ? 'btn-indicator--active' : ''}`}
          >
            Bollinger
          </button>
          <button
            onClick={() => setShowMa9(!showMa9)}
            className={`btn-indicator ${showMa9 ? 'btn-indicator--active' : ''}`}
          >
            MA 9
          </button>
          <button
            onClick={() => setShowMa21(!showMa21)}
            className={`btn-indicator ${showMa21 ? 'btn-indicator--active' : ''}`}
          >
            MA 21
          </button>
          <button
            onClick={() => setShowMa50(!showMa50)}
            className={`btn-indicator ${showMa50 ? 'btn-indicator--active' : ''}`}
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
          >
            RSI
          </button>
          <button
            onClick={() => setShowMacd(!showMacd)}
            className={`btn-indicator ${showMacd ? 'btn-indicator--active' : ''}`}
          >
            MACD
          </button>
          <button
            onClick={() => setShowAdx(!showAdx)}
            className={`btn-indicator ${showAdx ? 'btn-indicator--active' : ''}`}
          >
            ADX
          </button>
        </div>
      </div>

      {/* Charts Stack */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Main Price Chart */}
        <div ref={chartContainerRef} style={{ flex: 2, minHeight: '200px', width: '100%', position: 'relative' }} />

        {/* RSI Pane */}
        {showRsi && (
          <div
            ref={rsiContainerRef}
            style={{ height: '110px', minHeight: '110px', width: '100%', borderTop: '1px solid var(--qs-border)' }}
          />
        )}

        {/* MACD Pane */}
        {showMacd && (
          <div
            ref={macdContainerRef}
            style={{ height: '110px', minHeight: '110px', width: '100%', borderTop: '1px solid var(--qs-border)' }}
          />
        )}

        {/* ADX Pane */}
        {showAdx && (
          <div
            ref={adxContainerRef}
            style={{ height: '110px', minHeight: '110px', width: '100%', borderTop: '1px solid var(--qs-border)' }}
          />
        )}
      </div>
    </div>
  )
}
