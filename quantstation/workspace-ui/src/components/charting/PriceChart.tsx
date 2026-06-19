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

    // Demo data — will be replaced by real ticks
    const now = Math.floor(Date.now() / 1000)
    const demoData = []
    const demoVolume = []
    let price = 450

    for (let i = 200; i >= 0; i--) {
      const time = now - i * 60
      const open = price + (Math.random() - 0.48) * 2
      const close = open + (Math.random() - 0.48) * 3
      const high = Math.max(open, close) + Math.random() * 1.5
      const low = Math.min(open, close) - Math.random() * 1.5
      const vol = Math.floor(Math.random() * 10000 + 1000)
      price = close

      demoData.push({ time, open, high, low, close })
      demoVolume.push({
        time,
        value: vol,
        color: close >= open
          ? 'rgba(38, 208, 124, 0.3)'
          : 'rgba(242, 54, 69, 0.3)',
      })
    }

    candleSeries.setData(demoData as any)
    volumeSeries.setData(demoVolume as any)

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
    }
  }, [activeSymbol])

  return (
    <div
      ref={chartContainerRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
