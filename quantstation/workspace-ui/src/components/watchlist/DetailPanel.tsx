import React, { useState } from 'react'
import { useStore } from '../../store/useStore'

export const DetailPanel: React.FC = () => {
  const { selectedWatchlistSymbol, ticks, manualSymbols, detailPanelOpen, toggleDetailPanel, setActiveSymbol } = useStore()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    news: true,
    options: true,
    flow: true,
    float: true,
    sector: true,
    tech: true,
    ai: true,
  })

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (!detailPanelOpen) {
    return (
      <div className="wl-detail-collapsed">
        <button onClick={toggleDetailPanel} className="wl-detail-collapsed__btn" title="Expand Detail Panel">
          ◀ DETAIL PANEL
        </button>
      </div>
    )
  }

  const symbolStr = selectedWatchlistSymbol || 'SPY'
  const tick = ticks[symbolStr]
  const manual = manualSymbols.find((s) => s.symbol === symbolStr)

  const price = tick && tick.price > 0 ? tick.price : (manual ? manual.price : 0)
  const prevClose = tick && tick.prevClose > 0 ? tick.prevClose : (manual ? manual.prevClose : price)
  const change = prevClose > 0 ? price - prevClose : 0
  const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0
  const isPositive = change >= 0

  const handleHeaderClick = () => {
    setActiveSymbol(symbolStr)
    if (window.electronAPI?.selectSymbol) {
      window.electronAPI.selectSymbol(symbolStr)
    }
  }

  return (
    <div className="wl-detail-panel">
      {/* Header */}
      <div className="wl-detail-header">
        <div className="wl-detail-header__top">
          <div className="wl-detail-header__symbol-group" onClick={handleHeaderClick} title="Click to load in Workspace">
            <span className="wl-detail-header__symbol">{symbolStr}</span>
            <span className="wl-detail-header__name">{manual ? manual.companyName : `${symbolStr} Corp.`}</span>
          </div>
          <button onClick={toggleDetailPanel} className="wl-detail-header__close" title="Collapse Panel">
            ▶
          </button>
        </div>

        <div className="wl-detail-header__price-row">
          <span className="wl-detail-header__price">
            {price > 0 ? `$${price.toFixed(2)}` : '--'}
          </span>
          <span className={`wl-detail-header__change ${isPositive ? 'wl-detail-header__change--up' : 'wl-detail-header__change--down'}`}>
            {price > 0 ? `${isPositive ? '+' : ''}${change.toFixed(2)} (${isPositive ? '+' : ''}${changePct.toFixed(2)}%)` : '--'}
          </span>
        </div>
      </div>

      {/* Accordion Sections */}
      <div className="wl-detail-content">
        {/* Section 1: Latest News */}
        <div className="wl-detail-section">
          <button onClick={() => toggleSection('news')} className="wl-detail-section__title">
            <span>📰 Latest News & Catalysts</span>
            <span>{openSections.news ? '▼' : '▶'}</span>
          </button>
          {openSections.news && (
            <div className="wl-detail-section__body">
              <div className="wl-detail-news-item">
                <span className="wl-detail-news-tag wl-detail-news-tag--high">HIGH</span>
                <span className="wl-detail-news-text">{symbolStr} reports Q2 earnings beat expectations by 12%</span>
              </div>
              <div className="wl-detail-news-item">
                <span className="wl-detail-news-tag wl-detail-news-tag--med">MED</span>
                <span className="wl-detail-news-text">Analyst upgrades price target to $165 following product expansion</span>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Options Summary */}
        <div className="wl-detail-section">
          <button onClick={() => toggleSection('options')} className="wl-detail-section__title">
            <span>🎯 Options Flow Summary</span>
            <span>{openSections.options ? '▼' : '▶'}</span>
          </button>
          {openSections.options && (
            <div className="wl-detail-section__body grid-2col">
              <div className="wl-kv"><span className="wl-kv__label">Call/Put Ratio:</span><span className="wl-kv__val">--</span></div>
              <div className="wl-kv"><span className="wl-kv__label">IV Rank:</span><span className="wl-kv__val">--</span></div>
              <div className="wl-kv"><span className="wl-kv__label">Max Pain:</span><span className="wl-kv__val">--</span></div>
              <div className="wl-kv"><span className="wl-kv__label">Expected Move:</span><span className="wl-kv__val">--</span></div>
            </div>
          )}
        </div>

        {/* Section 3: Order Flow */}
        <div className="wl-detail-section">
          <button onClick={() => toggleSection('flow')} className="wl-detail-section__title">
            <span>⚡ Order Flow & Tape</span>
            <span>{openSections.flow ? '▼' : '▶'}</span>
          </button>
          {openSections.flow && (
            <div className="wl-detail-section__body grid-2col">
              <div className="wl-kv">
                <span className="wl-kv__label">Bid/Ask Spread:</span>
                <span className="wl-kv__val">
                  {tick && tick.bidPrice > 0 && tick.askPrice > 0
                    ? `$${Math.max(0, tick.askPrice - tick.bidPrice).toFixed(2)}`
                    : manual && manual.spread > 0
                    ? `$${manual.spread.toFixed(2)}`
                    : '--'}
                </span>
              </div>
              <div className="wl-kv">
                <span className="wl-kv__label">RVOL 20-Day:</span>
                <span className="wl-kv__val">
                  {tick && tick.volume && tick.volume > 0 && manual && manual.avgVolume && manual.avgVolume > 0
                    ? `${(tick.volume / manual.avgVolume).toFixed(1)}x`
                    : manual && manual.rvol > 0
                    ? `${manual.rvol.toFixed(1)}x`
                    : '--'}
                </span>
              </div>
              <div className="wl-kv"><span className="wl-kv__label">L2 Imbalance:</span><span className="wl-kv__val">--</span></div>
              <div className="wl-kv"><span className="wl-kv__label">Block Prints:</span><span className="wl-kv__val">--</span></div>
            </div>
          )}
        </div>

        {/* Section 4: Float & Short Interest */}
        <div className="wl-detail-section">
          <button onClick={() => toggleSection('float')} className="wl-detail-section__title">
            <span>📊 Float & Short Interest</span>
            <span>{openSections.float ? '▼' : '▶'}</span>
          </button>
          {openSections.float && (
            <div className="wl-detail-section__body grid-2col">
              <div className="wl-kv"><span className="wl-kv__label">Float Shares:</span><span className="wl-kv__val">{manual && manual.float > 0 ? `${(manual.float / 1000000).toFixed(1)}M` : '--'}</span></div>
              <div className="wl-kv"><span className="wl-kv__label">Short % Float:</span><span className="wl-kv__val">{manual && manual.shortFloatPercent > 0 ? `${manual.shortFloatPercent}%` : '--'}</span></div>
              <div className="wl-kv"><span className="wl-kv__label">Market Cap:</span><span className="wl-kv__val">{manual && manual.marketCap > 0 ? `$${(manual.marketCap / 1000000000).toFixed(1)}B` : '--'}</span></div>
              <div className="wl-kv"><span className="wl-kv__label">Borrow Fee:</span><span className="wl-kv__val">{manual && manual.borrowRate > 0 ? `${manual.borrowRate}%` : '--'}</span></div>
            </div>
          )}
        </div>

        {/* Section 5: Technical Snapshot */}
        <div className="wl-detail-section">
          <button onClick={() => toggleSection('tech')} className="wl-detail-section__title">
            <span>📈 Technical Snapshot</span>
            <span>{openSections.tech ? '▼' : '▶'}</span>
          </button>
          {openSections.tech && (
            <div className="wl-detail-section__body grid-2col">
              <div className="wl-kv"><span className="wl-kv__label">ATR (14-Day):</span><span className="wl-kv__val">{manual && manual.atr > 0 ? `$${manual.atr.toFixed(2)}` : '--'}</span></div>
              <div className="wl-kv"><span className="wl-kv__label">RSI (14-Day):</span><span className="wl-kv__val">--</span></div>
              <div className="wl-kv"><span className="wl-kv__label">VWAP:</span><span className="wl-kv__val">{price > 0 ? `$${price.toFixed(2)}` : '--'}</span></div>
              <div className="wl-kv"><span className="wl-kv__label">52W Range:</span><span className="wl-kv__val">--</span></div>
            </div>
          )}
        </div>

        {/* Section 6: AI / Quant Recommendation */}
        <div className="wl-detail-section">
          <button onClick={() => toggleSection('ai')} className="wl-detail-section__title">
            <span>🧠 AI Signal Summary</span>
            <span>{openSections.ai ? '▼' : '▶'}</span>
          </button>
          {openSections.ai && (
            <div className="wl-detail-section__body">
              <div className="wl-ai-badge">
                <span className="wl-ai-badge__score">Overall Score: --</span>
                <span className="wl-ai-badge__grade">Grade --</span>
              </div>
              <p className="wl-ai-text">
                No active AI signal generated for {symbolStr}.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
