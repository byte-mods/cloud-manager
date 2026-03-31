import * as React from "react"

interface StatCardProps {
  label: string
  value: string | number
  change?: number
  icon?: React.ReactNode
  description?: string
}

export function StatCard({ label, value, change, icon, description }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {change !== undefined && (
          <span className={`text-xs font-medium ${change > 0 ? "text-green-500" : change < 0 ? "text-red-500" : "text-muted-foreground"}`}>
            {change > 0 ? "+" : ""}{change}%
          </span>
        )}
      </div>
      {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
    </div>
  )
}
