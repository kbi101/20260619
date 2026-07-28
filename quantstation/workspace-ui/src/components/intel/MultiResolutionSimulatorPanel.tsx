import React, { useState } from 'react'

interface SimulatorPanelProps {
  onScenarioInjected: () => void
}

export const MultiResolutionSimulatorPanel: React.FC<SimulatorPanelProps> = ({ onScenarioInjected }) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('SPY')
  const [loading, setLoading] = useState<boolean>(false)
  const [logs, setLogs] = useState<string[]>([
    'Simulator ready. Select a scenario to inject synthetic market setups.'
  ])
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const [streamTimer, setStreamTimer] = useState<any>(null)

  const addLog = (msg: string) => {
    setLogs(prev => [ `[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 19) ])
  }

  const triggerScenario = async (scenario: string) => {
    setLoading(true)
    addLog(`Injecting scenario: ${scenario} for ${selectedSymbol}...`)
    try {
      const res = await fetch(`http://localhost:8080/api/v1/signals/multi-resolution/simulate?symbol=${selectedSymbol}&scenario=${scenario}`, {
        method: 'POST'
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      addLog(`✓ Scenario Result: ${data.consensusBadge} (Last Px: $${data.lastPx?.toFixed(2)})`)
      onScenarioInjected()
    } catch (err: any) {
      addLog(`❌ Simulation error: ${err.message || 'Engine offline'}`)
    } finally {
      setLoading(false)
    }
  }

  const toggleStreaming = () => {
    if (isStreaming) {
      if (streamTimer) clearInterval(streamTimer)
      setStreamTimer(null)
      setIsStreaming(false)
      addLog('⏸ Real-time tick stream simulation paused.')
    } else {
      setIsStreaming(true)
      addLog('▶ Real-time tick stream simulation active (1 tick / 2s)...')
      const timer = setInterval(() => {
        const scenarios = ['BULLISH_OVERSOLD', 'OVERBOUGHT_RALLY', 'VOLATILITY_SHOCK', 'NEUTRAL_RESET']
        const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)]
        triggerScenario(randomScenario)
      }, 2000)
      setStreamTimer(timer)
    }
  }

  return (
    <div style={{
      background: 'var(--qs-bg-primary)',
      borderBottom: '1px solid var(--qs-border)',
      padding: '10px 12px',
      fontSize: '11px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {/* Top Controls Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, color: '#3B82F6', display: 'flex', alignItems: 'center', gap: '4px' }}>
            🧪 Scenario Simulator:
          </span>
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            style={{
              background: 'var(--qs-bg-secondary)',
              color: 'var(--qs-text-primary)',
              border: '1px solid var(--qs-border)',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '11px',
            }}
          >
            <option value="SPY">SPY</option>
            <option value="QQQ">QQQ</option>
            <option value="IWM">IWM</option>
            <option value="XLK">XLK</option>
            <option value="WMT">WMT</option>
          </select>
        </div>

        {/* Preset Buttons */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            disabled={loading}
            onClick={() => triggerScenario('BULLISH_OVERSOLD')}
            style={{
              background: '#10B98122',
              color: '#10B981',
              border: '1px solid #10B98144',
              borderRadius: '4px',
              padding: '3px 8px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            🚀 Bullish Oversold
          </button>

          <button
            disabled={loading}
            onClick={() => triggerScenario('OVERBOUGHT_RALLY')}
            style={{
              background: '#EF444422',
              color: '#EF4444',
              border: '1px solid #EF444444',
              borderRadius: '4px',
              padding: '3px 8px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            📉 Overbought Rally
          </button>

          <button
            disabled={loading}
            onClick={() => triggerScenario('VOLATILITY_SHOCK')}
            style={{
              background: '#F59E0B22',
              color: '#F59E0B',
              border: '1px solid #F59E0B44',
              borderRadius: '4px',
              padding: '3px 8px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            ⚠️ Volatility Shock
          </button>

          <button
            disabled={loading}
            onClick={() => triggerScenario('NEUTRAL_RESET')}
            style={{
              background: 'var(--qs-bg-secondary)',
              color: 'var(--qs-text-secondary)',
              border: '1px solid var(--qs-border)',
              borderRadius: '4px',
              padding: '3px 8px',
              cursor: 'pointer',
            }}
          >
            🔍 Neutral Reset
          </button>

          <button
            onClick={toggleStreaming}
            style={{
              background: isStreaming ? '#3B82F622' : 'var(--qs-bg-secondary)',
              color: isStreaming ? '#3B82F6' : 'var(--qs-text-secondary)',
              border: `1px solid ${isStreaming ? '#3B82F666' : 'var(--qs-border)'}`,
              borderRadius: '4px',
              padding: '3px 8px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {isStreaming ? '⏸ Pause Stream' : '▶ Play Real-Time Stream'}
          </button>
        </div>
      </div>

      {/* Audit Log Output Box */}
      <div style={{
        background: '#00000044',
        border: '1px solid var(--qs-border)',
        borderRadius: '4px',
        padding: '6px 8px',
        fontFamily: 'var(--qs-font-mono)',
        fontSize: '10px',
        maxHeight: '54px',
        overflowY: 'auto',
        color: 'var(--qs-text-secondary)',
      }}>
        {logs.map((log, i) => (
          <div key={i} style={{ lineHeight: '1.4' }}>{log}</div>
        ))}
      </div>
    </div>
  )
}
