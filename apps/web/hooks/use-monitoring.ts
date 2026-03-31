import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export type Alert = {
  id: string;
  name: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
  status: 'firing' | 'acknowledged' | 'resolved';
};

export type ServiceHealth = {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  responseTime: number;
};

export type LogEntry = {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  service: string;
  message: string;
};

export type Metric = {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
};

export type Dashboard = {
  id: string;
  name: string;
  widgets: number;
  lastModified: string;
};

export type Trace = {
  id: string;
  duration: number;
  service: string;
  status: 'ok' | 'error';
};

export type MonitoringOverview = {
  uptime: number;
  errorRate: number;
  avgResponseTime: number;
  activeAlerts: number;
};

type UseMonitoringOptions = {
  enabled?: boolean;
};

export function useMonitoringOverview(options?: UseMonitoringOptions): UseQueryResult<MonitoringOverview> {
  return useQuery<MonitoringOverview>({
    queryKey: ['monitoring', 'overview'],
    queryFn: () => apiClient.get<MonitoringOverview>('/v1/monitoring'),
    enabled: options?.enabled !== false,
  });
}

export function useMonitoringAlerts(options?: UseMonitoringOptions): UseQueryResult<{ alerts: Alert[] }> {
  return useQuery<{ alerts: Alert[] }>({
    queryKey: ['monitoring', 'alerts'],
    queryFn: () => apiClient.get<{ alerts: Alert[] }>('/v1/monitoring/alerts'),
    enabled: options?.enabled !== false,
  });
}

export function useMonitoringLogs(
  options?: UseMonitoringOptions & { limit?: number; level?: string }
): UseQueryResult<{ logs: LogEntry[] }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.level) params.set('level', options.level);

  const query = params.toString();
  return useQuery<{ logs: LogEntry[] }>({
    queryKey: ['monitoring', 'logs', query],
    queryFn: () => apiClient.get<{ logs: LogEntry[] }>(`/v1/monitoring/logs${query ? `?${query}` : ''}`),
    enabled: options?.enabled !== false,
  });
}

export function useMonitoringMetrics(options?: UseMonitoringOptions): UseQueryResult<{ metrics: Metric[] }> {
  return useQuery<{ metrics: Metric[] }>({
    queryKey: ['monitoring', 'metrics'],
    queryFn: () => apiClient.get<{ metrics: Metric[] }>('/v1/monitoring/metrics'),
    enabled: options?.enabled !== false,
  });
}

export function useMonitoringUptime(options?: UseMonitoringOptions): UseQueryResult<{ services: ServiceHealth[] }> {
  return useQuery<{ services: ServiceHealth[] }>({
    queryKey: ['monitoring', 'uptime'],
    queryFn: () => apiClient.get<{ services: ServiceHealth[] }>('/v1/monitoring/uptime'),
    enabled: options?.enabled !== false,
  });
}

export function useMonitoringDashboards(options?: UseMonitoringOptions): UseQueryResult<{ dashboards: Dashboard[] }> {
  return useQuery<{ dashboards: Dashboard[] }>({
    queryKey: ['monitoring', 'dashboards'],
    queryFn: () => apiClient.get<{ dashboards: Dashboard[] }>('/v1/monitoring/dashboards'),
    enabled: options?.enabled !== false,
  });
}

export function useMonitoringTraces(options?: UseMonitoringOptions): UseQueryResult<{ traces: Trace[] }> {
  return useQuery<{ traces: Trace[] }>({
    queryKey: ['monitoring', 'traces'],
    queryFn: () => apiClient.get<{ traces: Trace[] }>('/v1/monitoring/tracing'),
    enabled: options?.enabled !== false,
  });
}

// ── WebSocket-based live metrics ─────────────────────────────────────────

export type LiveMetric = {
  name: string;
  display_name: string;
  value: number;
  unit: string;
};

export type LiveMetricsSnapshot = {
  type: string;
  timestamp: string;
  metrics: LiveMetric[];
};

type MonitoringWebSocketOptions = {
  /** WebSocket URL. Defaults to ws://localhost:8087/api/v1/monitoring/ws */
  url?: string;
  /** Metric names to subscribe to. Empty = all metrics. */
  subscribe?: string[];
  /** Whether the hook is enabled. */
  enabled?: boolean;
  /** Max data points kept per metric for chart history. Default 60. */
  maxHistory?: number;
};

export type MetricHistory = {
  name: string;
  displayName: string;
  unit: string;
  current: number;
  history: { timestamp: string; value: number }[];
};

const WS_BASE_DELAY = 1000;
const WS_MAX_DELAY = 30000;
const POLLING_INTERVAL = 5000;

export function useMonitoringWebSocket(options?: MonitoringWebSocketOptions) {
  const {
    url = 'ws://localhost:8087/api/v1/monitoring/ws',
    subscribe,
    enabled = true,
    maxHistory = 60,
  } = options ?? {};

  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState<Record<string, MetricHistory>>({});
  const [usingFallback, setUsingFallback] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const manualDisconnectRef = useRef(false);
  const subscribeRef = useRef(subscribe);
  subscribeRef.current = subscribe;

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pollingTimerRef.current !== null) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  const applySnapshot = useCallback(
    (snapshot: LiveMetricsSnapshot) => {
      setMetrics((prev) => {
        const next = { ...prev };
        for (const m of snapshot.metrics) {
          const existing = next[m.name];
          const entry = { timestamp: snapshot.timestamp, value: m.value };
          const history = existing
            ? [...existing.history, entry].slice(-maxHistory)
            : [entry];
          next[m.name] = {
            name: m.name,
            displayName: m.display_name,
            unit: m.unit,
            current: m.value,
            history,
          };
        }
        return next;
      });
    },
    [maxHistory],
  );

  // Fallback polling via REST
  const startPolling = useCallback(() => {
    setUsingFallback(true);
    const poll = async () => {
      try {
        const data = await apiClient.get<{ metrics: Metric[] }>('/v1/monitoring/metrics');
        const now = new Date().toISOString();
        const snapshot: LiveMetricsSnapshot = {
          type: 'metrics',
          timestamp: now,
          metrics: (data.metrics ?? []).map((m) => ({
            name: m.name,
            display_name: m.name,
            value: m.value,
            unit: m.unit,
          })),
        };
        applySnapshot(snapshot);
      } catch {
        // silently retry next interval
      }
    };
    poll();
    pollingTimerRef.current = setInterval(poll, POLLING_INTERVAL);
  }, [applySnapshot]);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setUsingFallback(false);
        reconnectAttemptRef.current = 0;

        // Stop polling if we reconnected
        if (pollingTimerRef.current !== null) {
          clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }

        // Send subscription if specified
        if (subscribeRef.current && subscribeRef.current.length > 0) {
          ws.send(JSON.stringify({ subscribe: subscribeRef.current }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'metrics') {
            applySnapshot(data as LiveMetricsSnapshot);
          }
        } catch {
          // ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        if (!manualDisconnectRef.current) {
          const attempt = reconnectAttemptRef.current;
          const delay = Math.min(WS_BASE_DELAY * Math.pow(2, attempt), WS_MAX_DELAY);
          reconnectAttemptRef.current += 1;

          // After 3 failed attempts, fall back to polling
          if (attempt >= 3 && pollingTimerRef.current === null) {
            startPolling();
          }

          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      const attempt = reconnectAttemptRef.current;
      const delay = Math.min(WS_BASE_DELAY * Math.pow(2, attempt), WS_MAX_DELAY);
      reconnectAttemptRef.current += 1;

      if (attempt >= 3 && pollingTimerRef.current === null) {
        startPolling();
      }

      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    }
  }, [url, applySnapshot, startPolling]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      manualDisconnectRef.current = true;
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    manualDisconnectRef.current = false;
    connect();

    return () => {
      manualDisconnectRef.current = true;
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [url, enabled, connect, clearTimers]);

  // Re-send subscription when subscribe list changes
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && subscribe && subscribe.length > 0) {
      wsRef.current.send(JSON.stringify({ subscribe }));
    }
  }, [subscribe]);

  return {
    isConnected,
    metrics,
    usingFallback,
    send,
  };
}
