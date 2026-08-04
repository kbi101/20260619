import React from 'react'
import { CATEGORIES } from './constants'
import { useStore } from '../../store/useStore'
import type { CategoryId } from './types'

export const CategorySidebar: React.FC = () => {
  const { activeCategory, setActiveCategory, manualSymbols, favoriteSymbols } = useStore()

  const getBadgeCount = (id: CategoryId): number | null => {
    if (id === 'manual') return manualSymbols.length
    if (id === 'favorites') return favoriteSymbols.length
    return null
  }

  return (
    <div className="wl-sidebar">
      <div className="wl-sidebar__header">
        CATEGORIES
      </div>
      <div className="wl-sidebar__list">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id
          const count = getBadgeCount(cat.id)
          const isPhase1 = cat.phase === 1

          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`wl-sidebar__item ${isActive ? 'wl-sidebar__item--active' : ''}`}
              title={cat.description}
            >
              <span className="wl-sidebar__icon">{cat.icon}</span>
              <span className="wl-sidebar__label">{cat.label}</span>
              {count !== null && (
                <span className={`wl-sidebar__badge ${isActive ? 'wl-sidebar__badge--active' : ''}`}>
                  {count}
                </span>
              )}
              {!isPhase1 && (
                <span className="wl-sidebar__phase">P{cat.phase}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
