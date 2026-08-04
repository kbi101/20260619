import React from 'react'
import { useStore } from '../../store/useStore'
import { CATEGORY_MAP } from './constants'

interface StatusBarProps {
  symbolCount: number
}

export const StatusBar: React.FC<StatusBarProps> = ({ symbolCount }) => {
  const { activeCategory, connected, ibkrConnected } = useStore()
  const activeConfig = CATEGORY_MAP[activeCategory]

  return (
    <div className="wl-statusbar">
      <div className="wl-statusbar__left">
        <span className="wl-statusbar__item">
          Category: <strong>{activeConfig ? activeConfig.label : activeCategory}</strong>
        </span>
        <span className="wl-statusbar__item">
          Symbols: <strong>{symbolCount}</strong>
        </span>
        {activeConfig && activeConfig.phase > 1 && (
          <span className="wl-statusbar__item wl-statusbar__item--warn">
            ⚠️ Preview Mode (Phase {activeConfig.phase})
          </span>
        )}
      </div>

      <div className="wl-statusbar__right">
        <span className="wl-statusbar__item">
          WS: <span className={connected ? 'pnl--positive' : 'pnl--negative'}>{connected ? '● Connected' : '○ Offline'}</span>
        </span>
        <span className="wl-statusbar__item">
          IBKR: <span className={ibkrConnected ? 'pnl--positive' : 'pnl--negative'}>{ibkrConnected ? '● Connected' : '○ Offline'}</span>
        </span>
      </div>
    </div>
  )
}
