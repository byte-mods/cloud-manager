"use client"

import { memo } from "react"
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react"
import { Lock } from "lucide-react"

const protocolColors: Record<string, string> = {
  HTTP: "#22c55e",
  HTTPS: "#a855f7",
  gRPC: "#3b82f6",
  TCP: "#6b7280",
  UDP: "#6b7280",
}

function TrafficEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const protocol = (data?.protocol as string) ?? "TCP"
  const encrypted = (data?.encrypted as boolean) ?? false
  const trafficRate = (data?.trafficRate as number) ?? 0
  const color = encrypted ? "#a855f7" : (protocolColors[protocol] ?? "#6b7280")
  const isActive = trafficRate > 0

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: isActive ? "6 4" : "none",
          opacity: selected ? 1 : 0.7,
        }}
        className={isActive ? "animate-dash" : ""}
      />
      {/* Animated particle along the edge */}
      {isActive && (
        <circle r="3" fill={color} opacity={0.9}>
          <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          className={`
            flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium
            bg-card/90 backdrop-blur-sm border border-border/50 shadow-sm
            transition-opacity duration-200
            ${selected ? "opacity-100" : "opacity-0 hover:opacity-100"}
          `}
        >
          {encrypted && <Lock className="h-2.5 w-2.5 text-purple-400" />}
          <span style={{ color }}>{protocol}</span>
          <span className="text-muted-foreground">
            {trafficRate >= 1000 ? `${(trafficRate / 1000).toFixed(1)}k` : trafficRate} req/s
          </span>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export default memo(TrafficEdgeComponent)
