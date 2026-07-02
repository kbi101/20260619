// ═══════════════════════════════════════════════════════
// QuantStation — WebSocket Market Stream Hook
// ═══════════════════════════════════════════════════════
// Manages STOMP WebSocket connection to Spring Boot backend

import { useEffect, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import { useStore } from '../store/useStore'
import type { Tick } from '../types/market'
import type { Order, Position, PnlSnapshot } from '../types/order'
import { processIncomingTick } from '../services/ChartDataManager'

const WS_URL = 'ws://localhost:8080/ws'

/**
 * Hook that manages the WebSocket lifecycle and routes
 * incoming messages to the Zustand store.
 */
export function useMarketStream(): void {
  const clientRef = useRef<Client | null>(null)
  const subscriptionsRef = useRef<Record<string, any>>({})
  const { connected, setConnected, setIbkrConnected, updateTick, updateOrder, updatePosition, updatePnl, activeSymbol, watchlist } =
    useStore()

  // Poll IBKR connection status
  useEffect(() => {
    if (!connected) {
      setIbkrConnected(false)
      return
    }

    let active = true
    const checkStatus = async () => {
      try {
        const res = await fetch('http://localhost:8080/api/ibkr/status')
        if (res.ok) {
          const data = await res.json()
          if (active) {
            setIbkrConnected(!!data.connected)
          }
        }
      } catch (e) {
        console.error('[QuantStation] Error checking IBKR connection status:', e)
        if (active) {
          setIbkrConnected(false)
        }
      }
    }

    checkStatus()
    const timerId = setInterval(checkStatus, 3000)

    return () => {
      active = false
      clearInterval(timerId)
    }
  }, [connected, setIbkrConnected])

  // Effect 1: STOMP Connection Lifecycle & Static Subscriptions
  useEffect(() => {
    const client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 2000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,

      onConnect: () => {
        console.log('[QuantStation] WebSocket connected')
        setConnected(true)

        // Fetch latest tick snapshot from the REST API to seed the store immediately
        fetch('http://localhost:8080/api/ticks/latest')
          .then((res) => {
            if (res.ok) return res.json()
            throw new Error('Failed to fetch latest ticks')
          })
          .then((latestTicks: Record<string, Tick>) => {
            console.log('[QuantStation] Loaded initial tick snapshot:', latestTicks)
            Object.values(latestTicks).forEach((tick) => {
              if (tick && tick.symbol) {
                updateTick(tick)
              }
            })
          })
          .catch((err) => {
            console.warn('[QuantStation] Could not fetch initial ticks snapshot:', err)
          })

        // Subscribe to order updates
        client.subscribe('/topic/orders', (message) => {
          const order: Order = JSON.parse(message.body)
          updateOrder(order)
        })

        // Subscribe to position updates
        client.subscribe('/topic/positions', (message) => {
          const position: Position = JSON.parse(message.body)
          updatePosition(position)
        })

        // Subscribe to PnL updates
        client.subscribe('/topic/pnl', (message) => {
          const pnl: PnlSnapshot = JSON.parse(message.body)
          updatePnl(pnl)
        })
      },

      onDisconnect: () => {
        console.log('[QuantStation] WebSocket disconnected')
        setConnected(false)
        // Clear subscriptions map on disconnect
        subscriptionsRef.current = {}
      },

      onStompError: (frame) => {
        console.error('[QuantStation] STOMP error:', frame.headers.message)
        setConnected(false)
        subscriptionsRef.current = {}
      },
    })

    client.activate()
    clientRef.current = client

    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate()
      }
      subscriptionsRef.current = {}
    }
  }, [setConnected, updateTick, updateOrder, updatePosition, updatePnl])

  // Effect 2: Dynamic Tick Subscriptions
  useEffect(() => {
    const client = clientRef.current
    if (!client || !connected || !client.connected) return

    // Build the set of desired destinations:
    // High-precision chart for activeSymbol, standard for others in watchlist
    const desiredDestinations = new Set<string>()
    if (activeSymbol) {
      desiredDestinations.add(`/topic/ticks/chart/${activeSymbol}`)
    }
    watchlist.forEach((item) => {
      if (item.symbol !== activeSymbol) {
        desiredDestinations.add(`/topic/ticks/${item.symbol}`)
      }
    })

    console.log(`[QuantStation] Effect 2 running. activeSymbol="${activeSymbol}", desiredDestinations=${JSON.stringify(Array.from(desiredDestinations))}, activeSubscriptions=${JSON.stringify(Object.keys(subscriptionsRef.current))}`)

    // Unsubscribe from destinations no longer needed
    Object.keys(subscriptionsRef.current).forEach((dest) => {
      if (!desiredDestinations.has(dest)) {
        console.log(`[QuantStation] Dynamically unsubscribing from ${dest}`)
        try {
          subscriptionsRef.current[dest].unsubscribe()
        } catch (e) {
          console.warn(`[QuantStation] Failed to unsubscribe from ${dest}`, e)
        }
        delete subscriptionsRef.current[dest]
      }
    })

    // Subscribe to new destinations
    let hasNewSub = false
    desiredDestinations.forEach((dest) => {
      if (!subscriptionsRef.current[dest]) {
        hasNewSub = true
        console.log(`[QuantStation] Dynamically subscribing to ${dest}`)
        
        let symbol = ''
        if (dest.startsWith('/topic/ticks/chart/')) {
          symbol = dest.substring('/topic/ticks/chart/'.length)
        } else if (dest.startsWith('/topic/ticks/')) {
          symbol = dest.substring('/topic/ticks/'.length)
        }

        try {
          const sub = client.subscribe(dest, (message) => {
            console.log(`[QuantStation] Received tick for ${symbol} on ${dest}:`, message.body)
            try {
              const tick: Tick = JSON.parse(message.body)
              updateTick(tick)
              processIncomingTick(tick)
            } catch (err) {
              console.error(`[QuantStation] Failed to parse tick message for ${symbol} on ${dest}:`, err)
            }
          })
          subscriptionsRef.current[dest] = sub
        } catch (e) {
          console.error(`[QuantStation] Failed to subscribe to ${dest}`, e)
        }
      }
    })

    if (hasNewSub) {
      // Fetch latest ticks from the REST API to seed the store immediately for the new symbol(s)
      fetch('http://localhost:8080/api/ticks/latest')
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error('Failed to fetch latest ticks')
        })
        .then((latestTicks: Record<string, Tick>) => {
          console.log('[QuantStation] Seeding store with latest ticks for new subscription:', latestTicks)
          Object.values(latestTicks).forEach((tick) => {
            if (tick && tick.symbol) {
              updateTick(tick)
            }
          })
        })
        .catch((err) => {
          console.warn('[QuantStation] Could not seed ticks snapshot for new subscription:', err)
        })
    }
  }, [connected, watchlist, activeSymbol, updateTick])
}
