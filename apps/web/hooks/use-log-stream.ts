'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────

export type LogStreamFilter = {
  level?: string
  service?: string
  search?: string
}

export type StreamedLogEntry = {
  id: string
  timestamp: string
  level: string
  service: string
  message: string
  trace_id?: string | null
}

type ServerMessage = {
  type: string
  entries?: StreamedLogEntry[]
  filter?: LogStreamFilter
  message?: string
}

type UseLogStreamReturn = {
  logs: StreamedLogEntry[]
  isConnected: boolean
  setFilter: (filter: LogStreamFilter) => void
  clearLogs: () => void
}

// ── Constants ────────────────────────────────────────────────────────────

const MAX_LOGS = 500
const MAX_RECONNECT_DELAY = 30_000
const BASE_RECONNECT_DELAY = 1_000

// ── Hook ─────────────────────────────────────────────────────────────────

export function useLogStream(url: string): UseLogStreamReturn {
  const [logs, setLogs] = useState<StreamedLogEntry[]>([])
  const [isConnected, setIsConnected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manualDisconnectRef = useRef(false)
  const pendingFilterRef = useRef<LogStreamFilter | null>(null)

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        reconnectAttemptRef.current = 0

        // Re-send pending filter if we had one before reconnect
        if (pendingFilterRef.current) {
          ws.send(JSON.stringify({ subscribe: pendingFilterRef.current }))
        }
      }

      ws.onmessage = (event) => {
        try {
          const data: ServerMessage = JSON.parse(event.data)

          if (data.type === 'log_entries' && data.entries) {
            setLogs((prev) => {
              const next = [...prev, ...data.entries!]
              // Cap at MAX_LOGS to prevent unbounded memory growth
              return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next
            })
          }
        } catch {
          // Ignore non-JSON messages
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null

        if (!manualDisconnectRef.current) {
          const delay = Math.min(
            BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
            MAX_RECONNECT_DELAY,
          )
          reconnectAttemptRef.current += 1
          reconnectTimerRef.current = setTimeout(() => {
            connect()
          }, delay)
        }
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      const delay = Math.min(
        BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
        MAX_RECONNECT_DELAY,
      )
      reconnectAttemptRef.current += 1
      reconnectTimerRef.current = setTimeout(() => {
        connect()
      }, delay)
    }
  }, [url])

  const setFilter = useCallback((filter: LogStreamFilter) => {
    pendingFilterRef.current = filter
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ subscribe: filter }))
    }
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  useEffect(() => {
    manualDisconnectRef.current = false
    connect()

    return () => {
      manualDisconnectRef.current = true
      clearReconnectTimer()
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [url, connect, clearReconnectTimer])

  return { logs, isConnected, setFilter, clearLogs }
}
