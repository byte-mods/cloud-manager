import type { CloudProvider } from "./cloud"

export interface CostData {
  provider: CloudProvider
  service: string
  region: string
  amount: number
  currency: string
  period: string
  change?: number
}

export interface Budget {
  id: string
  name: string
  amount: number
  spent: number
  period: "monthly" | "quarterly" | "annual"
  alertThresholds: number[]
  status: "on_track" | "warning" | "exceeded"
}

export interface CostRecommendation {
  id: string
  type: "rightsizing" | "reserved_instance" | "waste" | "savings_plan"
  title: string
  description: string
  estimatedSavings: number
  effort: "low" | "medium" | "high"
  provider: CloudProvider
  resourceId?: string
}

export interface CostAnomaly {
  id: string
  service: string
  provider: CloudProvider
  expectedCost: number
  actualCost: number
  deviation: number
  detectedAt: string
  status: "active" | "resolved" | "dismissed"
}

export interface CostForecast {
  period: string
  predicted: number
  lower: number
  upper: number
  confidence: number
}
