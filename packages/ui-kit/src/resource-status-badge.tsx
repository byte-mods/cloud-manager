import * as React from "react"

type Status = "running" | "stopped" | "pending" | "error" | "terminated" | "available" | "creating" | "deleting"

const statusConfig: Record<Status, { dot: string; text: string }> = {
  running: { dot: "bg-green-500", text: "text-green-700 dark:text-green-400" },
  available: { dot: "bg-green-500", text: "text-green-700 dark:text-green-400" },
  stopped: { dot: "bg-gray-400", text: "text-gray-600 dark:text-gray-400" },
  pending: { dot: "bg-yellow-500", text: "text-yellow-700 dark:text-yellow-400" },
  creating: { dot: "bg-yellow-500", text: "text-yellow-700 dark:text-yellow-400" },
  error: { dot: "bg-red-500", text: "text-red-700 dark:text-red-400" },
  terminated: { dot: "bg-red-500", text: "text-red-700 dark:text-red-400" },
  deleting: { dot: "bg-red-400", text: "text-red-600 dark:text-red-400" },
}

export function ResourceStatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status] ?? statusConfig.pending
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {status}
    </span>
  )
}
