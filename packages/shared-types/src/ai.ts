export type MessageRole = "user" | "assistant" | "system"

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface AIContext {
  provider?: string
  module?: string
  resources?: string[]
  costData?: Record<string, unknown>
  securityFindings?: string[]
}

export interface AISuggestion {
  id: string
  type: "cost" | "security" | "architecture" | "performance"
  title: string
  description: string
  priority: "high" | "medium" | "low"
  estimatedImpact?: string
  actionable: boolean
}

export interface ArchitectureReview {
  pillar: "operational_excellence" | "security" | "reliability" | "performance" | "cost_optimization" | "sustainability"
  score: number
  findings: { severity: string; description: string; recommendation: string }[]
}

export interface IaCGenerationRequest {
  description: string
  provider: string
  format: "terraform" | "cloudformation" | "bicep"
}
