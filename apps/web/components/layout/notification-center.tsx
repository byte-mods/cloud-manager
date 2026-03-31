"use client"

import { useEffect } from "react"
import {
  Bell,
  Info,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  CheckCheck,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  useNotificationStore,
  type Notification,
} from "@/stores/notification-store"

const typeConfig: Record<
  Notification["type"],
  { icon: typeof Info; color: string; bg: string }
> = {
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10" },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  error: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
  success: {
    icon: CheckCircle2,
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHr / 24)

  if (diffSec < 60) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  return `${diffDays}d ago`
}

const seedNotifications: Array<{
  type: Notification["type"]
  title: string
  message: string
  module?: string
}> = [
  {
    type: "warning",
    title: "High CPU Usage",
    message: "EC2 instance web-server-1 CPU usage at 92%",
    module: "compute",
  },
  {
    type: "info",
    title: "Policy Change Detected",
    message: "S3 bucket policy change detected",
    module: "storage",
  },
  {
    type: "success",
    title: "Backup Completed",
    message: "RDS prod-postgres backup completed",
    module: "databases",
  },
  {
    type: "error",
    title: "Critical Vulnerabilities",
    message: "Security scan found 3 critical vulnerabilities",
    module: "security",
  },
  {
    type: "warning",
    title: "Cost Anomaly",
    message: "Cost anomaly: GCP Compute Engine spend up 24%",
    module: "cost",
  },
  {
    type: "info",
    title: "New Compliance Assessment",
    message: "New compliance assessment available: SOC2",
    module: "security_testing",
  },
  {
    type: "error",
    title: "VM Stopped Unexpectedly",
    message: "Azure VM azure-dev-1 stopped unexpectedly",
    module: "compute",
  },
  {
    type: "warning",
    title: "SSL Certificate Expiring",
    message: "SSL certificate expires in 7 days",
    module: "security",
  },
]

function NotificationItem({ notification }: { notification: Notification }) {
  const { markAsRead } = useNotificationStore()
  const config = typeConfig[notification.type]
  const Icon = config.icon

  return (
    <button
      className={`w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors ${
        !notification.read ? "bg-muted/30" : ""
      }`}
      onClick={() => markAsRead(notification.id)}
    >
      <div className="flex gap-2.5">
        <div
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${config.bg}`}
        >
          <Icon className={`h-3.5 w-3.5 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p
              className={`text-sm truncate ${
                !notification.read ? "font-semibold" : "font-normal"
              }`}
            >
              {notification.title}
            </p>
            {!notification.read && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {notification.message}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {formatRelativeTime(notification.createdAt)}
          </p>
        </div>
      </div>
    </button>
  )
}

export function NotificationCenter() {
  const { notifications, unreadCount, addNotification, markAllAsRead, clearAll } =
    useNotificationStore()

  useEffect(() => {
    if (notifications.length === 0) {
      seedNotifications.forEach((n, i) => {
        setTimeout(() => {
          addNotification(n)
        }, i * 50)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <h4 className="text-sm font-semibold">Notifications</h4>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={clearAll}
              disabled={notifications.length === 0}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          </div>
        </div>

        {/* Notification list */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Bell className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
