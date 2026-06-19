import React from 'react'

interface MacroEvent {
  time: string
  currency: string
  event: string
  impact: 'HIGH' | 'MED' | 'LOW'
  consensus: string
  previous: string
  actual: string
  state: 'released' | 'upcoming' | 'imminent'
}

const EVENTS_DATA: MacroEvent[] = [
  { time: '08:30', currency: 'USD', event: 'Core Retail Sales (MoM) (May)', impact: 'HIGH', consensus: '0.2%', previous: '0.1%', actual: '0.3%', state: 'released' },
  { time: '08:30', currency: 'USD', event: 'Initial Jobless Claims', impact: 'HIGH', consensus: '220K', previous: '229K', actual: '222K', state: 'released' },
  { time: '09:15', currency: 'USD', event: 'Industrial Production (MoM) (May)', impact: 'MED', consensus: '0.3%', previous: '0.0%', actual: '0.9%', state: 'released' },
  { time: '10:00', currency: 'USD', event: 'Business Inventories (Apr)', impact: 'LOW', consensus: '0.3%', previous: '-0.1%', actual: '0.3%', state: 'released' },
  { time: '13:00', currency: 'USD', event: '10-Year Bond Auction', impact: 'MED', consensus: '--', previous: '4.43%', actual: '--', state: 'upcoming' },
  { time: '14:00', currency: 'USD', event: 'FOMC Statement & Interest Rate Decision', impact: 'HIGH', consensus: '5.50%', previous: '5.50%', actual: '--', state: 'upcoming' },
  { time: '14:30', currency: 'USD', event: 'Fed Press Conference', impact: 'HIGH', consensus: '--', previous: '--', actual: '--', state: 'upcoming' },
]

export const EconomicCalendar: React.FC = () => {
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
      boxSizing: 'border-box',
    }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: 'var(--qs-font-mono)',
        fontSize: 'var(--qs-font-xs)',
        textAlign: 'left',
      }}>
        <thead>
          <tr style={{
            borderBottom: '1px solid var(--qs-border)',
            color: 'var(--qs-text-muted)',
            position: 'sticky',
            top: 0,
            background: 'var(--qs-bg-secondary)',
            height: '32px',
          }}>
            <th style={{ padding: '0 8px', width: '60px' }}>Time</th>
            <th style={{ padding: '0 4px', width: '40px' }}>Cur</th>
            <th style={{ padding: '0 8px' }}>Event</th>
            <th style={{ padding: '0 4px', width: '50px', textAlign: 'center' }}>Imp</th>
            <th style={{ padding: '0 8px', textAlign: 'right', width: '65px' }}>Cons</th>
            <th style={{ padding: '0 8px', textAlign: 'right', width: '65px' }}>Prev</th>
            <th style={{ padding: '0 8px', textAlign: 'right', width: '65px' }}>Act</th>
          </tr>
        </thead>
        <tbody>
          {EVENTS_DATA.map((event, idx) => {
            const isHigh = event.impact === 'HIGH'
            const isUpcoming = event.state === 'upcoming'

            return (
              <tr
                key={idx}
                style={{
                  height: '36px',
                  borderBottom: '1px solid var(--qs-border)',
                  background: isUpcoming && isHigh ? 'rgba(242, 54, 69, 0.03)' : 'transparent',
                }}
              >
                <td style={{
                  padding: '0 8px',
                  color: isUpcoming ? 'var(--qs-text-primary)' : 'var(--qs-text-muted)',
                  fontWeight: isUpcoming ? 'bold' : 'normal',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '36px',
                }}>
                  {isUpcoming && isHigh && (
                    <span style={{
                      display: 'inline-block',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: 'var(--qs-amber)',
                      boxShadow: '0 0 8px var(--qs-amber)',
                      animation: 'pulse 1.5s infinite',
                    }} />
                  )}
                  {event.time}
                </td>
                <td style={{ padding: '0 4px', color: 'var(--qs-text-secondary)' }}>
                  {event.currency}
                </td>
                <td style={{
                  padding: '0 8px',
                  color: isUpcoming ? 'var(--qs-text-primary)' : 'var(--qs-text-secondary)',
                  fontWeight: isUpcoming ? 'bold' : 'normal',
                }}>
                  {event.event}
                </td>
                <td style={{ padding: '0 4px', textAlign: 'center' }}>
                  <span style={{
                    color: getImpactColor(event.impact),
                    fontWeight: 'bold',
                  }}>
                    {event.impact === 'HIGH' ? '!!!' : event.impact === 'MED' ? '!!' : '!'}
                  </span>
                </td>
                <td style={{ padding: '0 8px', textAlign: 'right', color: 'var(--qs-text-secondary)' }}>
                  {event.consensus}
                </td>
                <td style={{ padding: '0 8px', textAlign: 'right', color: 'var(--qs-text-secondary)' }}>
                  {event.previous}
                </td>
                <td style={{
                  padding: '0 8px',
                  textAlign: 'right',
                  fontWeight: 'bold',
                  color: event.actual === '--'
                    ? 'var(--qs-text-muted)'
                    : (parseFloat(event.actual) >= parseFloat(event.consensus) ? 'var(--qs-green)' : 'var(--qs-red)'),
                }}>
                  {event.actual}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
