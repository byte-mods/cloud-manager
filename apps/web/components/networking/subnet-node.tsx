"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Badge } from "@/components/ui/badge"
import { Layers } from "lucide-react"

export type SubnetNodeData = {
  label: string
  cidr: string
  az: string
  isPublic: boolean
  provider: "aws" | "gcp" | "azure"
}

function SubnetNodeComponent({ data }: NodeProps) {
  const d = data as unknown as SubnetNodeData

  return (
    <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white/90 dark:bg-gray-900/80 px-3 py-2 min-w-[180px] shadow-sm">
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-gray-400" />
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-gray-400" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2.5 !h-2.5 !bg-gray-400" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2.5 !h-2.5 !bg-gray-400" />

      <div className="flex items-center gap-1.5 mb-1">
        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold truncate">{d.label}</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {d.cidr}
        </Badge>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {d.az}
        </Badge>
        <Badge
          variant={d.isPublic ? "default" : "secondary"}
          className="text-[10px] px-1.5 py-0"
        >
          {d.isPublic ? "Public" : "Private"}
        </Badge>
      </div>
    </div>
  )
}

export const SubnetNode = memo(SubnetNodeComponent)
