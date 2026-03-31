'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

type UseRealtimeOptions = {
  onMessage?: (data: any) => void;
  enabled?: boolean;
};

type UseRealtimeReturn = {
  isConnected: boolean;
  send: (data: unknown) => void;
  disconnect: () => void;
};

const MAX_RECONNECT_DELAY = 30_000;
const BASE_RECONNECT_DELAY = 1_000;

export function useRealtime(
  url: string,
  options?: UseRealtimeOptions
): UseRealtimeReturn {
  const { onMessage, enabled = true } = options ?? {};

  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  const manualDisconnectRef = useRef(false);

  // Keep onMessage ref current to avoid reconnecting on callback changes
  onMessageRef.current = onMessage;

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current?.(data);
        } catch {
          onMessageRef.current?.(event.data);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        if (!manualDisconnectRef.current) {
          const delay = Math.min(
            BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
            MAX_RECONNECT_DELAY
          );
          reconnectAttemptRef.current += 1;

          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        // onerror is always followed by onclose, so reconnect logic is handled there
        ws.close();
      };
    } catch {
      // Connection constructor failed, schedule retry
      const delay = Math.min(
        BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
        MAX_RECONNECT_DELAY
      );
      reconnectAttemptRef.current += 1;

      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    }
  }, [url]);

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true;
    clearReconnectTimer();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [clearReconnectTimer]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      disconnect();
      return;
    }

    manualDisconnectRef.current = false;
    connect();

    return () => {
      manualDisconnectRef.current = true;
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [url, enabled, connect, disconnect, clearReconnectTimer]);

  return { isConnected, send, disconnect };
}

export type { UseRealtimeOptions, UseRealtimeReturn };
