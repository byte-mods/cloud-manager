"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Wifi, WifiOff, RefreshCw } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMonitoringWebSocket, type MetricHistory } from "@/hooks/use-monitoring";

const CHART_METRICS = ["cpu", "memory", "network_in", "disk"] as const;

const METRIC_CONFIG: Record<
  string,
  { color: string; label: string; domain?: [number, number] }
> = {
  cpu: { color: "#3b82f6", label: "CPU Usage", domain: [0, 100] },
  memory: { color: "#8b5cf6", label: "Memory Usage", domain: [0, 100] },
  disk: { color: "#f59e0b", label: "Disk Usage", domain: [0, 100] },
  network_in: { color: "#10b981", label: "Network In" },
  network_out: { color: "#06b6d4", label: "Network Out" },
  request_rate: { color: "#ec4899", label: "Request Rate" },
  error_rate: { color: "#ef4444", label: "Error Rate", domain: [0, 10] },
};

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return ts;
  }
}

function MetricChart({ metric }: { metric: MetricHistory }) {
  const config = METRIC_CONFIG[metric.name] ?? {
    color: "#6b7280",
    label: metric.displayName,
  };

  const data = useMemo(
    () =>
      metric.history.map((h) => ({
        time: formatTime(h.timestamp),
        value: h.value,
      })),
    [metric.history],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{config.label}</CardTitle>
            <CardDescription>
              Current: {metric.current} {metric.unit}
            </CardDescription>
          </div>
          <span
            className="text-2xl font-bold tabular-nums"
            style={{ color: config.color }}
          >
            {metric.current}
            <span className="text-sm font-normal text-muted-foreground ml-1">
              {metric.unit}
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              domain={config.domain ?? ["auto", "auto"]}
              width={45}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={config.color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={true}
              animationDuration={400}
              animationEasing="ease-in-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function ConnectionIndicator({
  isConnected,
  usingFallback,
}: {
  isConnected: boolean;
  usingFallback: boolean;
}) {
  if (isConnected) {
    return (
      <Badge variant="outline" className="gap-1.5 text-green-600 border-green-300">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        Live
      </Badge>
    );
  }

  if (usingFallback) {
    return (
      <Badge variant="outline" className="gap-1.5 text-yellow-600 border-yellow-300">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Polling
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1.5 text-red-600 border-red-300">
      <span className="relative flex h-2 w-2">
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
      </span>
      Disconnected
    </Badge>
  );
}

export default function LiveMonitoringPage() {
  const { isConnected, metrics, usingFallback } = useMonitoringWebSocket();

  const allMetrics = Object.values(metrics);
  const chartMetrics = CHART_METRICS.map((name) => metrics[name]).filter(
    Boolean,
  ) as MetricHistory[];
  const otherMetrics = allMetrics.filter(
    (m) => !CHART_METRICS.includes(m.name as (typeof CHART_METRICS)[number]),
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/monitoring">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Live Metrics</h1>
            <p className="text-muted-foreground mt-1">
              Real-time infrastructure metrics updated every 5 seconds.
            </p>
          </div>
        </div>
        <ConnectionIndicator
          isConnected={isConnected}
          usingFallback={usingFallback}
        />
      </div>

      {allMetrics.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            {isConnected ? (
              <>
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Waiting for first metric snapshot...
                </p>
              </>
            ) : (
              <>
                <WifiOff className="h-8 w-8 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Connecting to metrics stream...
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {chartMetrics.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {chartMetrics.map((metric) => (
            <MetricChart key={metric.name} metric={metric} />
          ))}
        </div>
      )}

      {otherMetrics.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {otherMetrics.map((metric) => {
            const config = METRIC_CONFIG[metric.name];
            return (
              <Card key={metric.name}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    {config?.label ?? metric.displayName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="text-2xl font-bold tabular-nums"
                    style={{ color: config?.color }}
                  >
                    {metric.current}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      {metric.unit}
                    </span>
                  </div>
                  {metric.history.length > 1 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {metric.history.length} data points collected
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
