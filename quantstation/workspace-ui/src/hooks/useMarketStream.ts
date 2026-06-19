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
  const { setConnected, updateTick, updateOrder, updatePosition, updatePnl, activeSymbol } =
    useStore()

  useEffect(() => {
    const client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 2000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,

      onConnect: () => {
        console.log('[QuantStation] WebSocket connected')
        setConnected(true)

        // Subscribe to market ticks for the active symbol
        client.subscribe(`/topic/ticks/${activeSymbol}`, (message) => {
          const tick: Tick = JSON.parse(message.body)
          updateTick(tick)
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
      },

      onStompError: (frame) => {
        console.error('[QuantStation] STOMP error:', frame.headers.message)
        setConnected(false)
      },
    })

    client.activate()
    clientRef.current = client

    return () => {
      if (clientRef.current?.connected) {
        clientRef.current.deactivate()
      }
    }
  }, [activeSymbol, setConnected, updateTick, updateOrder, updatePosition, updatePnl])
}
