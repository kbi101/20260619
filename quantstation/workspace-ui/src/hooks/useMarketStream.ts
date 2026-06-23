// ═══════════════════════════════════════════════════════
// QuantStation — WebSocket Market Stream Hook
// ═══════════════════════════════════════════════════════
// Manages STOMP WebSocket connection to Spring Boot backend

import { useEffect, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import { useStore } from '../store/useStore'
import type { Tick } from '../types/market'
import type { Order, Position, PnlSnapshot } from '../types/order'

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

    const symbolsToSubscribe = watchlist.map((item) => item.symbol)
    if (!symbolsToSubscribe.includes(activeSymbol)) {
      symbolsToSubscribe.push(activeSymbol)
    }

    console.log(`[QuantStation] Effect 2 running. activeSymbol="${activeSymbol}", symbolsToSubscribe=${JSON.stringify(symbolsToSubscribe)}, activeSubscriptions=${JSON.stringify(Object.keys(subscriptionsRef.current))}`)

    // Unsubscribe from symbols no longer needed
    Object.keys(subscriptionsRef.current).forEach((symbol) => {
      if (!symbolsToSubscribe.includes(symbol)) {
        console.log(`[QuantStation] Dynamically unsubscribing from /topic/ticks/${symbol}`)
        try {
          subscriptionsRef.current[symbol].unsubscribe()
        } catch (e) {
          console.warn(`[QuantStation] Failed to unsubscribe from /topic/ticks/${symbol}`, e)
        }
        delete subscriptionsRef.current[symbol]
      }
    })

    // Subscribe to new symbols
    let hasNewSub = false
    symbolsToSubscribe.forEach((symbol) => {
      if (!subscriptionsRef.current[symbol]) {
        hasNewSub = true
        console.log(`[QuantStation] Dynamically subscribing to /topic/ticks/${symbol}`)
        try {
          const sub = client.subscribe(`/topic/ticks/${symbol}`, (message) => {
            console.log(`[QuantStation] Received tick for ${symbol}:`, message.body)
            try {
              const tick: Tick = JSON.parse(message.body)
              updateTick(tick)
            } catch (err) {
              console.error(`[QuantStation] Failed to parse tick message for ${symbol}:`, err)
            }
          })
          subscriptionsRef.current[symbol] = sub
        } catch (e) {
          console.error(`[QuantStation] Failed to subscribe to /topic/ticks/${symbol}`, e)
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
