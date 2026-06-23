import React, { useEffect, useRef } from 'react'
import { createChart, type IChartApi, type ISeriesApi, ColorType } from 'lightweight-charts'
import { useStore } from '../../store/useStore'

/**
 * Price chart powered by TradingView Lightweight Charts.
 *
 * WebGL-accelerated, 60fps rendering on Apple Silicon.
 * Subscribes to tick updates and renders real-time candlesticks.
 */
export const PriceChart: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const { activeSymbol } = useStore()
  
  const tick = useStore((state) => state.ticks[activeSymbol])
  const currentBarRef = useRef<{ time: number; open: number; high: number; low: number; close: number; volume: number } | null>(null)

  // ── 1. Initialize Chart & Fetch History ─────────────
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

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26d07c',
      downColor: '#f23645',
      borderUpColor: '#26d07c',
      borderDownColor: '#f23645',
      wickUpColor: '#26d07c',
      wickDownColor: '#f23645',
    })

    // Volume histogram
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })

    // Fetch real historical data from IBKR
    fetch(`http://localhost:8080/api/history/bars?symbol=${activeSymbol}&duration=1 D&barSize=1 min`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch historical bars')
        return res.json()
      })
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const bars = data.map((b: any) => ({
            time: Math.floor(new Date(b.barStart).getTime() / 1000),
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close
          }))
          const volumes = data.map((b: any) => ({
            time: Math.floor(new Date(b.barStart).getTime() / 1000),
            value: b.volume,
            color: b.close >= b.open ? 'rgba(38, 208, 124, 0.3)' : 'rgba(242, 54, 69, 0.3)'
          }))
          
          candleSeries.setData(bars as any)
          volumeSeries.setData(volumes as any)

          // Track the last bar for streaming tick updates
          const lastBar = data[data.length - 1]
          currentBarRef.current = {
            time: Math.floor(new Date(lastBar.barStart).getTime() / 1000),
            open: lastBar.open,
            high: lastBar.high,
            low: lastBar.low,
            close: lastBar.close,
            volume: lastBar.volume
          }
        }
      })
      .catch((err) => {
        console.warn("[PriceChart] Could not fetch historical bars, chart will start empty.", err)
      })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    // Handle resize
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
      currentBarRef.current = null
    }
  }, [activeSymbol])

  // ── 2. Stream Live Tick Data into Current Minute Bar ──
  useEffect(() => {
    if (!tick || !candleSeriesRef.current || !volumeSeriesRef.current) return

    const time = Math.floor(new Date(tick.timestamp).getTime() / 1000)
    const roundedTime = Math.floor(time / 60) * 60 // Round to start of minute

    const lastBar = currentBarRef.current

    if (lastBar && lastBar.time === roundedTime) {
      // Update the current minute bar
      lastBar.high = Math.max(lastBar.high, tick.price)
      lastBar.low = Math.min(lastBar.low, tick.price)
      lastBar.close = tick.price
      lastBar.volume += tick.size
    } else {
      // Create a new minute bar
      currentBarRef.current = {
        time: roundedTime,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.size
      }
    }

    const current = currentBarRef.current
    if (current) {
      candleSeriesRef.current.update({
        time: current.time,
        open: current.open,
        high: current.high,
        low: current.low,
        close: current.close
      } as any)

      volumeSeriesRef.current.update({
        time: current.time,
        value: current.volume,
        color: current.close >= current.open ? 'rgba(38, 208, 124, 0.3)' : 'rgba(242, 54, 69, 0.3)'
      } as any)
    }
  }, [tick])

  return (
    <div
      ref={chartContainerRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
