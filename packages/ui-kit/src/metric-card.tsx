import * as React from "react"

interface MetricCardProps {
  label: string
  value: string | number
  unit?: string
  trend?: "up" | "down" | "flat"
  changePercent?: number
  sparkline?: number[]
}

export function MetricCard({ label, value, unit, trend, changePercent, sparkline }: MetricCardProps) {
  const trendColor = trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"
  const trendArrow = trend === "up" ? "\u2191" : trend === "down" ? "\u2193" : "\u2192"

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{value}</span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
        {changePercent !== undefined && (
          <span className={`text-xs font-medium ${trendColor}`}>
            {trendArrow} {Math.abs(changePercent)}%
          </span>
        )}
      </div>
      {sparkline && sparkline.length > 0 && (
        <div className="flex items-end gap-px h-8">
          {sparkline.map((v, i) => {
            const max = Math.max(...sparkline)
            const h = max > 0 ? (v / max) * 100 : 0
            return <div key={i} className="flex-1 bg-primary/20 rounded-t" style={{ height: `${h}%` }} />
          })}
        </div>
      )}
    </div>
  )
}
