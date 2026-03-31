"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Badge } from "@/components/ui/badge"
import { Network, Cloud, Server } from "lucide-react"

export type VpcNodeData = {
  label: string
  cidr: string
  region: string
  provider: "aws" | "gcp" | "azure"
  subnetCount: number
}

const providerStyles: Record<
  string,
  { border: string; bg: string; badge: string; icon: string; label: string }
> = {
  aws: {
    border: "border-orange-400 dark:border-orange-600",
    bg: "bg-orange-50/80 dark:bg-orange-950/30",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    icon: "text-orange-500",
    label: "AWS",
  },
  gcp: {
    border: "border-blue-400 dark:border-blue-600",
    bg: "bg-blue-50/80 dark:bg-blue-950/30",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    icon: "text-blue-500",
    label: "GCP",
  },
  azure: {
    border: "border-purple-400 dark:border-purple-600",
    bg: "bg-purple-50/80 dark:bg-purple-950/30",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    icon: "text-purple-500",
    label: "Azure",
  },
}

function VpcNodeComponent({ data }: NodeProps) {
  const d = data as unknown as VpcNodeData
  const style = providerStyles[d.provider] ?? providerStyles.aws

  return (
    <div
      className={`rounded-xl border-2 ${style.border} ${style.bg} px-4 py-3 min-w-[220px] shadow-md`}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-400" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-gray-400" />
      <Handle type="target" position={Position.Left} id="left" className="!w-3 !h-3 !bg-gray-400" />
      <Handle type="source" position={Position.Right} id="right" className="!w-3 !h-3 !bg-gray-400" />

      <div className="flex items-center gap-2 mb-1.5">
        <Network className={`h-5 w-5 ${style.icon}`} />
        <span className="text-sm font-bold truncate">{d.label}</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${style.badge} border-0`}>
          {style.label}
        </Badge>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {d.cidr}
        </Badge>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {d.region}
        </Badge>
      </div>

      <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Server className="h-3 w-3" />
        <span>{d.subnetCount} subnets</span>
      </div>
    </div>
  )
}

export const VpcNode = memo(VpcNodeComponent)
