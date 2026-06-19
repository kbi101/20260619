import React, { useEffect, useState } from 'react'

interface NewsItem {
  id: string
  time: string
  headline: string
  summary: string
  impact: 'HIGH' | 'MED' | 'LOW'
  symbol: string
}

const INITIAL_NEWS: NewsItem[] = [
  {
    id: '1',
    time: '12:15:30',
    headline: 'FOMC Meeting Minutes Hint at Rate Pause',
    summary: 'Committee members discuss tapering balance sheet reductions and balancing inflation targets.',
    impact: 'HIGH',
    symbol: 'SPY',
  },
  {
    id: '2',
    time: '12:02:10',
    headline: 'TSLA Earnings Outlook Focuses on Margins',
    summary: 'Analysts cut average target estimate but project robust production recovery in the upcoming quarters.',
    impact: 'MED',
    symbol: 'TSLA',
  },
  {
    id: '3',
    time: '11:45:00',
    headline: 'NVDA Supply Chain Shows Continued Strength',
    summary: 'Asian assembly lines ramp up production capacity of next-gen Hopper architecture substrates.',
    impact: 'LOW',
    symbol: 'NVDA',
  },
  {
    id: '4',
    time: '11:30:15',
    headline: 'AAPL Set to Expand AI Service Suite in Europe',
    summary: 'Local compliance approvals cleared for localized privacy cloud computing nodes.',
    impact: 'MED',
    symbol: 'AAPL',
  },
]

const MOCK_POOL = [
  { headline: 'CPI Release Figures Align with Estimates', summary: 'Core CPI figures print at 0.2% MoM, matching market consensus and easing bond volatility.', impact: 'HIGH', symbol: 'SPY' },
  { headline: 'AMD Launches Next-Gen AI Chip Grid', summary: 'Competitor announces immediate availability of MI325X accelerators to target NVDA market share.', impact: 'MED', symbol: 'NVDA' },
  { headline: 'MSFT Announces Enterprise Cloud Influx', summary: 'Azure contracts print double-digit expansion from mid-market financial services sectors.', impact: 'LOW', symbol: 'MSFT' },
  { headline: 'AMZN Logistical Drones Pass Final FAA Test', summary: 'Commercial drone deliveries approved for high-density metropolitan residential zones.', impact: 'MED', symbol: 'AMZN' },
  { headline: 'Hawkish Tone From Federal Reserve Governor', summary: 'Governor warns of persistent service-inflation triggers, indicating rates may remain higher for longer.', impact: 'HIGH', symbol: 'SPY' },
]

export const NewsFeed: React.FC = () => {
  const [news, setNews] = useState<NewsItem[]>(INITIAL_NEWS)

  useEffect(() => {
    const interval = setInterval(() => {
      const randomItem = MOCK_POOL[Math.floor(Math.random() * MOCK_POOL.length)]
      const now = new Date()
      const timeStr = now.toTimeString().split(' ')[0]

      const newItem: NewsItem = {
        id: Math.random().toString(),
        time: timeStr,
        headline: randomItem.headline,
        summary: randomItem.summary,
        impact: randomItem.impact as any,
        symbol: randomItem.symbol,
      }

      setNews((prev) => [newItem, ...prev.slice(0, 14)]) // Keep max 15 news items
    }, 20000) // Prepend news every 20 seconds

    return () => clearInterval(interval)
  }, [])

  const handleTickerClick = (symbol: string) => {
    if (window.electronAPI?.selectSymbol) {
      window.electronAPI.selectSymbol(symbol)
    }
  }

  const getImpactColor = (impact: 'HIGH' | 'MED' | 'LOW') => {
    switch (impact) {
      case 'HIGH': return 'var(--qs-red)'
      case 'MED': return 'var(--qs-amber)'
      case 'LOW': return 'var(--qs-blue)'
      default: return 'var(--qs-text-secondary)'
    }
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      padding: '8px',
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {news.map((item) => (
          <div
            key={item.id}
            style={{
              background: 'var(--qs-bg-tertiary)',
              border: '1px solid var(--qs-border)',
              borderRadius: 'var(--qs-radius-sm, 4px)',
              padding: '10px',
              transition: 'all 0.2s ease',
              position: 'relative',
              animation: 'fadeIn 0.3s ease-out',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontFamily: 'var(--qs-font-mono)',
                  fontSize: '10px',
                  color: 'var(--qs-text-muted)',
                }}>
                  {item.time}
                </span>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 'bold',
                  color: getImpactColor(item.impact),
                  background: 'var(--qs-bg-primary)',
                  padding: '2px 6px',
                  borderRadius: '2px',
                  border: `1px solid ${getImpactColor(item.impact)}40`,
                }}>
                  {item.impact}
                </span>
              </div>
              <span
                onClick={() => handleTickerClick(item.symbol)}
                style={{
                  fontFamily: 'var(--qs-font-mono)',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  color: 'var(--qs-text-primary)',
                  background: 'var(--qs-bg-primary)',
                  border: '1px solid var(--qs-border)',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                }}
                className="ticker-tag"
              >
                {item.symbol}
              </span>
            </div>
            <div style={{
              fontSize: 'var(--qs-font-sm, 12px)',
              fontWeight: 'bold',
              color: 'var(--qs-text-primary)',
              marginBottom: '4px',
            }}>
              {item.headline}
            </div>
            <div style={{
              fontSize: 'var(--qs-font-xs, 11px)',
              color: 'var(--qs-text-secondary)',
              lineHeight: '1.4',
            }}>
              {item.summary}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
