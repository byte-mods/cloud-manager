"use client"

import { useState } from "react"
import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  Play,
  Bug,
  Eye,
  Clock,
  ExternalLink,
  Filter,
  RefreshCw,
  MoreHorizontal,
  Cpu,
  Lock,
  Globe,
  Server,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { useVulnerabilities } from "@/hooks/use-security"

type Vulnerability = {
  id: string
  title: string
  severity: "critical" | "high" | "medium" | "low" | "info"
  category: string
  status: "open" | "in-progress" | "resolved" | "false-positive"
  cvss: number
  affectedResource: string
  discoveredAt: string
  lastSeen: string
}

type Scan = {
  id: string
  name: string
  status: "running" | "completed" | "failed" | "scheduled"
  type: "vulnerability" | "penetration" | "configuration"
  startedAt: string
  completedAt?: string
  vulnerabilitiesFound: number
  severityBreakdown: { critical: number; high: number; medium: number; low: number; info: number }
}


const severityVariants: Record<string, "destructive" | "secondary" | "outline" | "default"> = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
  info: "outline",
}

const severityColors: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
  info: "bg-gray-500",
}

const statusIcons: Record<string, React.ReactNode> = {
  critical: <ShieldAlert className="h-4 w-4 text-red-500" />,
  high: <ShieldAlert className="h-4 w-4 text-orange-500" />,
  medium: <Shield className="h-4 w-4 text-yellow-500" />,
  low: <Shield className="h-4 w-4 text-blue-500" />,
  info: <Eye className="h-4 w-4 text-gray-500" />,
}

const vulnerabilityColumns: ColumnDef<Vulnerability>[] = [
  { accessorKey: "severity", header: "Severity", cell: ({ row }) => (
    <div className="flex items-center gap-2">
      {statusIcons[row.original.severity]}
      <Badge variant={severityVariants[row.original.severity]} className="text-xs">
        {row.original.severity.toUpperCase()}
      </Badge>
    </div>
  )},
  { accessorKey: "title", header: "Vulnerability", cell: ({ row }) => (
    <div>
      <p className="font-medium text-sm">{row.original.title}</p>
      <p className="text-xs text-muted-foreground">{row.original.category}</p>
    </div>
  )},
  { accessorKey: "cvss", header: "CVSS", cell: ({ row }) => (
    <span className={`font-mono text-sm ${row.original.cvss >= 9 ? 'text-red-500 font-bold' : row.original.cvss >= 7 ? 'text-orange-500' : 'text-muted-foreground'}`}>
      {row.original.cvss.toFixed(1)}
    </span>
  )},
  { accessorKey: "affectedResource", header: "Affected Resource", cell: ({ row }) => (
    <Badge variant="outline" className="text-xs">{row.original.affectedResource}</Badge>
  )},
  { accessorKey: "status", header: "Status", cell: ({ row }) => (
    <Badge variant={row.original.status === "resolved" ? "default" : row.original.status === "in-progress" ? "secondary" : "outline"} className="text-xs capitalize">
      {row.original.status.replace("-", " ")}
    </Badge>
  )},
  { accessorKey: "lastSeen", header: "Last Seen", cell: ({ row }) => (
    <span className="text-sm text-muted-foreground">{row.original.lastSeen}</span>
  )},
  { id: "actions", header: "", cell: ({ row }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
        <DropdownMenuItem><Lock className="mr-2 h-4 w-4" /> Mark as Resolved</DropdownMenuItem>
        <DropdownMenuItem><Bug className="mr-2 h-4 w-4" /> Create False Positive</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem><ExternalLink className="mr-2 h-4 w-4" /> Link to Ticket</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )},
]

function ScanCard({ scan }: { scan: Scan }) {
  const totalVulns = scan.vulnerabilitiesFound
  const criticalCount = scan.severityBreakdown.critical

  return (
    <Card className={scan.status === "running" ? "border-blue-500/50" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {scan.status === "running" ? (
              <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
            ) : scan.type === "penetration" ? (
              <Bug className="h-4 w-4 text-purple-500" />
            ) : (
              <Shield className="h-4 w-4 text-muted-foreground" />
            )}
            <CardTitle className="text-sm">{scan.name}</CardTitle>
          </div>
          <Badge variant={scan.status === "completed" ? "default" : scan.status === "running" ? "secondary" : "outline"} className="text-xs">
            {scan.status}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {scan.startedAt}
          {scan.completedAt && ` - ${scan.completedAt}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Vulnerabilities Found</span>
            <span className={`text-lg font-bold ${criticalCount > 0 ? "text-red-500" : "text-foreground"}`}>
              {totalVulns}
            </span>
          </div>
          <div className="flex gap-1">
            {scan.severityBreakdown.critical > 0 && (
              <div className={`h-2 flex-1 rounded-full ${severityColors.critical}`} title={`${scan.severityBreakdown.critical} Critical`} />
            )}
            {scan.severityBreakdown.high > 0 && (
              <div className={`h-2 flex-1 rounded-full ${severityColors.high}`} title={`${scan.severityBreakdown.high} High`} />
            )}
            {scan.severityBreakdown.medium > 0 && (
              <div className={`h-2 flex-1 rounded-full ${severityColors.medium}`} title={`${scan.severityBreakdown.medium} Medium`} />
            )}
            {scan.severityBreakdown.low > 0 && (
              <div className={`h-2 flex-1 rounded-full ${severityColors.low}`} title={`${scan.severityBreakdown.low} Low`} />
            )}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{scan.severityBreakdown.critical} Critical</span>
            <span>{scan.severityBreakdown.high} High</span>
            <span>{scan.severityBreakdown.medium} Medium</span>
            <span>{scan.severityBreakdown.low} Low</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export default function VAPTPage() {
  const { data, isLoading } = useVulnerabilities()
  const [scanFilter, setScanFilter] = useState<string>("all")

  // Transform API data to UI format
  const apiVulns = data?.vulnerabilities ?? []
  const vulnerabilities: Vulnerability[] = apiVulns.map((v) => ({
      id: v.id,
      title: v.title,
      severity: v.severity,
      category: 'General',
      status: v.status,
      cvss: v.severity === 'critical' ? 9.5 : v.severity === 'high' ? 7.5 : v.severity === 'medium' ? 5.0 : 2.5,
      affectedResource: v.affectedResource,
      discoveredAt: new Date().toISOString().split('T')[0],
      remediation: 'Apply security patch',
    }))

  const filteredVulnerabilities = vulnerabilities.filter(v => {
    if (scanFilter === "all") return true
    return v.severity === scanFilter
  })

  const statsCards = [
    { title: "Total Vulnerabilities", value: vulnerabilities.length, icon: Bug, color: "text-orange-500" },
    { title: "Critical", value: vulnerabilities.filter(v => v.severity === "critical").length, icon: ShieldAlert, color: "text-red-500" },
    { title: "Open Issues", value: vulnerabilities.filter(v => v.status === "open").length, icon: AlertTriangle, color: "text-yellow-500" },
    { title: "Resolved This Month", value: vulnerabilities.filter(v => v.status === "resolved").length, icon: ShieldCheck, color: "text-green-500" },
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/security">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Security
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Vulnerability Assessment</h1>
            <p className="text-muted-foreground mt-1">
              Vulnerability scanning and penetration testing across your cloud infrastructure.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" /> Configure Scan
          </Button>
          <Button>
            <Play className="mr-2 h-4 w-4" /> Start New Scan
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="vulnerabilities">
        <TabsList>
          <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
          <TabsTrigger value="scans">Scan History</TabsTrigger>
        </TabsList>

        <TabsContent value="vulnerabilities" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Vulnerabilities</CardTitle>
                  <CardDescription>Detected vulnerabilities ranked by severity</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={scanFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setScanFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={scanFilter === "critical" ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => setScanFilter("critical")}
                  >
                    Critical
                  </Button>
                  <Button
                    variant={scanFilter === "high" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setScanFilter("high")}
                  >
                    High
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable columns={vulnerabilityColumns} data={filteredVulnerabilities} searchKey="title" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scans" className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">No data available</div>
        </TabsContent>
      </Tabs>

      {/* Top Attack Vectors */}
      <Card>
        <CardHeader>
          <CardTitle>Top Attack Vectors</CardTitle>
          <CardDescription>Most common vulnerability categories in your infrastructure</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { category: "Injection", count: 12, percentage: 35, icon: Server },
              { category: "Configuration", count: 9, percentage: 26, icon: Cpu },
              { category: "IAM", count: 7, percentage: 21, icon: Lock },
              { category: "Cryptography", count: 4, percentage: 12, icon: Globe },
              { category: "Other", count: 2, percentage: 6, icon: Shield },
            ].map((vector) => (
              <div key={vector.category} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <vector.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{vector.category}</span>
                  </div>
                  <span className="text-muted-foreground">{vector.count} vulnerabilities ({vector.percentage}%)</span>
                </div>
                <Progress value={vector.percentage} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
