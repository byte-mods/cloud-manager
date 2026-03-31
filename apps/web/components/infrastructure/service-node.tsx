"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import {
  Server,
  Database,
  HardDrive,
  Globe,
  Shield,
  Zap,
  Container,
  Wifi,
  Cloud,
  BarChart3,
  Brain,
  MessageSquare,
  Network,
  Lock,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ServiceNode as ServiceNodeType, ServiceType, CloudProvider } from "@/stores/infrastructure-store"

const typeIcons: Record<ServiceType, React.ElementType> = {
  compute: Server,
  storage: HardDrive,
  database: Database,
  networking: Globe,
  security: Shield,
  serverless: Zap,
  container: Container,
  cdn: Wifi,
  dns: Network,
  loadbalancer: Cloud,
  queue: MessageSquare,
  cache: Database,
  ml: Brain,
  monitoring: BarChart3,
}

const providerColors: Record<CloudProvider, string> = {
  aws: "border-orange-500/70",
  gcp: "border-blue-500/70",
  azure: "border-cyan-500/70",
  multi: "border-purple-500/70",
}

const providerGlow: Record<CloudProvider, string> = {
  aws: "shadow-orange-500/30",
  gcp: "shadow-blue-500/30",
  azure: "shadow-cyan-500/30",
  multi: "shadow-purple-500/30",
}

const providerBg: Record<CloudProvider, string> = {
  aws: "bg-orange-500/10",
  gcp: "bg-blue-500/10",
  azure: "bg-cyan-500/10",
  multi: "bg-purple-500/10",
}

const providerBadgeColor: Record<CloudProvider, string> = {
  aws: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  gcp: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  azure: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  multi: "bg-purple-500/20 text-purple-400 border-purple-500/30",
}

function ServiceNodeComponent({ data, selected }: NodeProps) {
  const serviceNode = data.serviceNode as ServiceNodeType
  if (!serviceNode) return null

  const Icon = typeIcons[serviceNode.type] ?? Server
  const borderColor = providerColors[serviceNode.provider]
  const glowColor = providerGlow[serviceNode.provider]
  const bgColor = providerBg[serviceNode.provider]
  const badgeColor = providerBadgeColor[serviceNode.provider]
  const securityCount = serviceNode.securityIssues?.length ?? 0
  const hasTraffic = (serviceNode.trafficIn ?? 0) > 0 || (serviceNode.trafficOut ?? 0) > 0

  return (
    <div
      className={`
        relative w-[170px] rounded-xl border-2 bg-card/95 backdrop-blur-sm p-3
        transition-all duration-200 cursor-pointer
        ${borderColor}
        ${selected ? `shadow-lg ${glowColor} ring-2 ring-primary/40` : "shadow-sm hover:shadow-md"}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-muted-foreground/50 !border-2 !border-background hover:!bg-primary transition-colors"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-muted-foreground/50 !border-2 !border-background hover:!bg-primary transition-colors"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-2.5 !h-2.5 !bg-muted-foreground/50 !border-2 !border-background hover:!bg-primary transition-colors"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-2.5 !h-2.5 !bg-muted-foreground/50 !border-2 !border-background hover:!bg-primary transition-colors"
      />

      {/* Traffic pulse */}
      {hasTraffic && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </span>
      )}

      <div className="flex items-start gap-2.5">
        <div className={`rounded-lg p-1.5 ${bgColor} shrink-0`}>
          <Icon className="h-4 w-4 text-foreground/80" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-foreground truncate leading-tight">
            {serviceNode.serviceName}
          </p>
          <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
            {serviceNode.label}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 mt-2 flex-wrap">
        <Badge className={`text-[9px] px-1.5 py-0 h-4 font-medium border ${badgeColor}`}>
          {serviceNode.provider.toUpperCase()}
        </Badge>
        {serviceNode.estimatedMonthlyCost > 0 && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-medium">
            ${serviceNode.estimatedMonthlyCost.toFixed(0)}/mo
          </Badge>
        )}
        {securityCount > 0 && (
          <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 font-medium">
            {securityCount} {securityCount === 1 ? "issue" : "issues"}
          </Badge>
        )}
      </div>
    </div>
  )
}

export default memo(ServiceNodeComponent)
