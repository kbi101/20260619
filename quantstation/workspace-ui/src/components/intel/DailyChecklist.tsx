import React, { useEffect, useState, useRef } from 'react'

interface DailyNotesData {
  profitTarget: string
  maxLoss: string
  checklist: Record<string, boolean>
  scratchNotes: string
}

const DEFAULT_STATE: DailyNotesData = {
  profitTarget: '1500',
  maxLoss: '500',
  checklist: {
    resetRisk: false,
    confirmQuestdb: false,
    validateGateway: false,
    premarketScan: false,
    checkMacro: false,
  },
  scratchNotes: '',
}

export const DailyChecklist: React.FC = () => {
  const [state, setState] = useState<DailyNotesData>(DEFAULT_STATE)
  const [saving, setSaving] = useState(false)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch saved states from Redis on mount
  useEffect(() => {
    fetch('http://localhost:8080/api/notes/daily')
      .then((res) => {
        if (!res.ok) throw new Error('Network error')
        return res.json()
      })
      .then((data) => {
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          setState({
            profitTarget: data.profitTarget ?? '1500',
            maxLoss: data.maxLoss ?? '500',
            checklist: data.checklist ?? DEFAULT_STATE.checklist,
            scratchNotes: data.scratchNotes ?? '',
          })
        }
      })
      .catch((err) => console.warn('[DailyChecklist] Could not connect to API, using defaults.', err))
  }, [])

  // Trigger POST save
  const triggerSave = (updatedState: DailyNotesData) => {
    setSaving(true)
    fetch('http://localhost:8080/api/notes/daily', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedState),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Save failed')
      })
      .catch((err) => console.error('[DailyChecklist] Error saving notes to Redis:', err))
      .finally(() => setSaving(false))
  }

  // Handle immediate checkbox saves
  const handleCheckboxChange = (key: string, value: boolean) => {
    const updated = {
      ...state,
      checklist: {
        ...state.checklist,
        [key]: value,
      },
    }
    setState(updated)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    triggerSave(updated)
  }

  // Handle debounced text saves
  const handleTextChange = (field: 'profitTarget' | 'maxLoss' | 'scratchNotes', value: string) => {
    const updated = {
      ...state,
      [field]: value,
    }
    setState(updated)

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaving(true)

    saveTimerRef.current = setTimeout(() => {
      triggerSave(updated)
    }, 1000) // Debounce for 1 second while typing
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      padding: '12px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      fontSize: 'var(--qs-font-xs, 11px)',
    }}>
      {/* ── Targets Row ─────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
      }}>
        <div>
          <label style={{ color: 'var(--qs-text-secondary)', display: 'block', marginBottom: '4px' }}>
            Daily Profit Target ($)
          </label>
          <input
            type="number"
            value={state.profitTarget}
            onChange={(e) => handleTextChange('profitTarget', e.target.value)}
            style={{
              width: '100%',
              background: 'var(--qs-bg-primary)',
              border: '1px solid var(--qs-border)',
              borderRadius: 'var(--qs-radius-sm)',
              color: 'var(--qs-green)',
              padding: '6px 8px',
              fontFamily: 'var(--qs-font-mono)',
              fontSize: '12px',
              fontWeight: 'bold',
              outline: 'none',
            }}
          />
        </div>
        <div>
          <label style={{ color: 'var(--qs-text-secondary)', display: 'block', marginBottom: '4px' }}>
            Daily Max Loss ($)
          </label>
          <input
            type="number"
            value={state.maxLoss}
            onChange={(e) => handleTextChange('maxLoss', e.target.value)}
            style={{
              width: '100%',
              background: 'var(--qs-bg-primary)',
              border: '1px solid var(--qs-border)',
              borderRadius: 'var(--qs-radius-sm)',
              color: 'var(--qs-red)',
              padding: '6px 8px',
              fontFamily: 'var(--qs-font-mono)',
              fontSize: '12px',
              fontWeight: 'bold',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* ── Checklist Column ────────────────────────── */}
      <div style={{
        background: 'var(--qs-bg-tertiary)',
        border: '1px solid var(--qs-border)',
        borderRadius: 'var(--qs-radius-sm)',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <span style={{ color: 'var(--qs-text-primary)', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>
          Pre-Market Checklist
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={state.checklist.resetRisk}
            onChange={(e) => handleCheckboxChange('resetRisk', e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ color: state.checklist.resetRisk ? 'var(--qs-text-muted)' : 'var(--qs-text-secondary)', textDecoration: state.checklist.resetRisk ? 'line-through' : 'none' }}>
            Reset daily risk draw limits in OMS
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={state.checklist.confirmQuestdb}
            onChange={(e) => handleCheckboxChange('confirmQuestdb', e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ color: state.checklist.confirmQuestdb ? 'var(--qs-text-muted)' : 'var(--qs-text-secondary)', textDecoration: state.checklist.confirmQuestdb ? 'line-through' : 'none' }}>
            Confirm QuestDB time-series WAL tables initialized
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={state.checklist.validateGateway}
            onChange={(e) => handleCheckboxChange('validateGateway', e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ color: state.checklist.validateGateway ? 'var(--qs-text-muted)' : 'var(--qs-text-secondary)', textDecoration: state.checklist.validateGateway ? 'line-through' : 'none' }}>
            Verify IB Gateway connection status (paper port 4002)
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={state.checklist.premarketScan}
            onChange={(e) => handleCheckboxChange('premarketScan', e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ color: state.checklist.premarketScan ? 'var(--qs-text-muted)' : 'var(--qs-text-secondary)', textDecoration: state.checklist.premarketScan ? 'line-through' : 'none' }}>
            Conduct pre-market gap / Relative Volume (RVOL) scans
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={state.checklist.checkMacro}
            onChange={(e) => handleCheckboxChange('checkMacro', e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ color: state.checklist.checkMacro ? 'var(--qs-text-muted)' : 'var(--qs-text-secondary)', textDecoration: state.checklist.checkMacro ? 'line-through' : 'none' }}>
            Verify macro calendar schedules (CPI / Fed Speak)
          </span>
        </label>
      </div>

      {/* ── Scratchpad Notes ────────────────────────── */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <label style={{ color: 'var(--qs-text-secondary)' }}>Daily Scratchpad / Targets Journal</label>
          <span style={{
            fontSize: '9px',
            color: 'var(--qs-text-muted)',
            fontStyle: 'italic',
          }}>
            {saving ? 'Saving to Redis...' : 'Saved to Redis'}
          </span>
        </div>
        <textarea
          value={state.scratchNotes}
          onChange={(e) => handleTextChange('scratchNotes', e.target.value)}
          placeholder="Enter notes, pivots, support/resistance levels, or journal thoughts for today's trading session..."
          style={{
            width: '100%',
            flexGrow: 1,
            minHeight: '80px',
            background: 'var(--qs-bg-primary)',
            border: '1px solid var(--qs-border)',
            borderRadius: 'var(--qs-radius-sm)',
            color: 'var(--qs-text-primary)',
            padding: '8px',
            fontSize: '11px',
            lineHeight: '1.4',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      </div>
    </div>
  )
}
