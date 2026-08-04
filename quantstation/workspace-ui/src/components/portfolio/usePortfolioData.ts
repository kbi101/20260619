// ═══════════════════════════════════════════════════════
// QuantStation — Portfolio Data Hook (SPEC-007)
// ═══════════════════════════════════════════════════════
// Provides portfolio data to all cockpit components.
// Currently returns mock data; swap to WebSocket/REST
// endpoints for live data with zero component changes.

import { useMemo } from 'react'
import { MOCK_PORTFOLIO_DATA } from './mockData'
import type { PortfolioData } from './types'

/**
 * usePortfolioData — Central data provider for the Portfolio Cockpit.
 *
 * Phase 1: Returns static mock data.
 * Phase 2: Will subscribe to Spring Boot WebSocket topics:
 *   - /topic/portfolio/account
 *   - /topic/portfolio/positions
 *   - /topic/portfolio/risk
 *   - /topic/portfolio/alerts
 * And REST endpoints for heavy analytics:
 *   - GET /api/portfolio/attribution
 *   - GET /api/portfolio/correlation
 */
export function usePortfolioData(): PortfolioData {
  // Memoize to prevent unnecessary re-renders
  const data = useMemo(() => MOCK_PORTFOLIO_DATA, [])
  return data
}
