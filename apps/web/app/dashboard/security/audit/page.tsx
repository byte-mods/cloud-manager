"use client"

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  FileText,
  Cloud,
  Filter,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuditLogs } from "@/hooks/use-security"

type AuditLog = {
  id: string
  timestamp: string
  user: string
  action: string
  resource: string
  provider: string
  status: "success" | "failure" | "warning"
  ipAddress: string
  details: string
}


const statusIcons: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failure: <XCircle className="h-4 w-4 text-red-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  failure: "destructive",
  warning: "secondary",
}

const columns: ColumnDef<AuditLog>[] = [
  { accessorKey: "timestamp", header: "Timestamp", cell: ({ row }) => (
    <span className="text-sm font-mono whitespace-nowrap">{row.original.timestamp}</span>
  )},
  { accessorKey: "user", header: "User", cell: ({ row }) => (
    <span className="text-sm font-medium">{row.original.user}</span>
  )},
  { accessorKey: "action", header: "Action", cell: ({ row }) => (
    <Badge variant="outline" className="font-mono text-xs">{row.original.action}</Badge>
  )},
  { accessorKey: "resource", header: "Resource", cell: ({ row }) => (
    <span className="text-sm font-mono">{row.original.resource}</span>
  )},
  { accessorKey: "provider", header: "Provider", cell: ({ row }) => (
    <div className="flex items-center gap-2">
      <Cloud className="h-4 w-4" />
      <span className="uppercase text-xs font-medium">{row.original.provider}</span>
    </div>
  )},
  { accessorKey: "status", header: "Status", cell: ({ row }) => (
    <div className="flex items-center gap-2">
      {statusIcons[row.original.status]}
      <Badge variant={statusVariants[row.original.status]}>{row.original.status}</Badge>
    </div>
  )},
  { accessorKey: "ipAddress", header: "IP Address", cell: ({ row }) => (
    <span className="text-sm font-mono">{row.original.ipAddress}</span>
  )},
]

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-[180px]" />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No audit logs found</h3>
      <p className="text-muted-foreground text-sm mt-1">
        No activity has been recorded matching your filters.
      </p>
    </div>
  )
}

export default function AuditLogsPage() {
  const { data, isLoading } = useAuditLogs()
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [userFilter, setUserFilter] = useState<string>("all")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Transform API data to UI format
  const apiLogs = data?.logs ?? []
  const auditLogs: AuditLog[] = apiLogs.map((l) => ({
      id: l.id,
      timestamp: l.timestamp.split('T').join(' '),
      user: l.user,
      action: l.action,
      resource: l.resource,
      provider: 'aws',
      status: l.status as AuditLog['status'],
      ipAddress: '0.0.0.0',
      details: `${l.action} on ${l.resource}`,
    }))

  const actions = useMemo(() => [...new Set(auditLogs.map((l) => l.action))], [auditLogs])
  const users = useMemo(() => [...new Set(auditLogs.map((l) => l.user))], [auditLogs])

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (actionFilter !== "all" && log.action !== actionFilter) return false
      if (userFilter !== "all" && log.user !== userFilter) return false
      if (providerFilter !== "all" && log.provider !== providerFilter) return false
      if (statusFilter !== "all" && log.status !== statusFilter) return false
      if (dateFrom && log.timestamp < dateFrom) return false
      if (dateTo && log.timestamp > dateTo) return false
      return true
    })
  }, [actionFilter, userFilter, providerFilter, statusFilter, dateFrom, dateTo, auditLogs])

  const handleExport = () => {
    const csv = [
      ["Timestamp", "User", "Action", "Resource", "Provider", "Status", "IP Address", "Details"].join(","),
      ...filteredLogs.map((l) =>
        [l.timestamp, l.user, l.action, l.resource, l.provider, l.status, l.ipAddress, `"${l.details}"`].join(",")
      ),
    ].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "audit-logs.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">
            Track all actions and changes across your cloud infrastructure.
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Activity Log ({filteredLogs.length})</CardTitle>
            <CardDescription>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span className="text-sm">Filters:</span>
                </div>
                <Input
                  type="date"
                  className="w-[160px] h-8"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="From date"
                />
                <Input
                  type="date"
                  className="w-[160px] h-8"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="To date"
                />
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-[160px] h-8">
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {actions.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger className="w-[180px] h-8">
                    <SelectValue placeholder="User" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={providerFilter} onValueChange={setProviderFilter}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    <SelectItem value="aws">AWS</SelectItem>
                    <SelectItem value="gcp">GCP</SelectItem>
                    <SelectItem value="azure">Azure</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failure">Failure</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredLogs.length === 0 ? (
              <EmptyState />
            ) : (
              <DataTable columns={columns} data={filteredLogs} searchKey="user" />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
