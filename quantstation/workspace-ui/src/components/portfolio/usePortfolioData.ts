// ═══════════════════════════════════════════════════════
// QuantStation — Portfolio Data Hook (SPEC-007)
// ═══════════════════════════════════════════════════════
// Provides portfolio data to all cockpit components.
// Currently returns mock data; swap to WebSocket/REST
// endpoints for live data with zero component changes.

import { useMemo } from 'react'
import { useStore } from '../../store/useStore'
import { MOCK_PORTFOLIO_DATA } from './mockData'
import type { PortfolioData } from './types'

/**
 * usePortfolioData — Central data provider for the Portfolio Cockpit.
 *
 * Hydrates real-time live account summary from Spring Boot WebSocket / REST (IBKR)
 * while providing mock fallbacks when offline or for static analytics.
 */
export function usePortfolioData(): PortfolioData {
  const { liveAccountSummary, selectedAccountId } = useStore()

  const data = useMemo(() => {
    if (liveAccountSummary) {
      return {
        ...MOCK_PORTFOLIO_DATA,
        account: {
          ...MOCK_PORTFOLIO_DATA.account,
          ...liveAccountSummary,
          accountId: liveAccountSummary.accountId || selectedAccountId,
          brokerageProvider: liveAccountSummary.brokerageProvider || 'IBKR',
          connected: liveAccountSummary.connected !== false,
        },
      }
    }
    return MOCK_PORTFOLIO_DATA
  }, [liveAccountSummary, selectedAccountId])

  return data
}
