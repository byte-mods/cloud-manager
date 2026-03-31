import * as React from "react"

interface CostIndicatorProps {
  amount: number
  currency?: string
  change?: number
  period?: string
}

export function CostIndicator({ amount, currency = "USD", change, period = "month" }: CostIndicatorProps) {
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
  const isUp = change !== undefined && change > 0
  const isDown = change !== undefined && change < 0

  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-lg font-bold">{formatted}</span>
      <span className="text-xs text-muted-foreground">/{period}</span>
      {change !== undefined && (
        <span className={`text-xs font-medium ${isUp ? "text-red-500" : isDown ? "text-green-500" : "text-muted-foreground"}`}>
          {isUp ? "\u2191" : isDown ? "\u2193" : "\u2192"}{Math.abs(change).toFixed(1)}%
        </span>
      )}
    </div>
  )
}
