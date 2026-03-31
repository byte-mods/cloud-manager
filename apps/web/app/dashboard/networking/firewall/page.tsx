"use client"

import { useState, useMemo } from "react"
import {
  Shield,
  Cloud,
  Filter,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  Settings,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useResources, type Resource } from "@/hooks/use-resources"

type SecurityGroup = Resource & {
  metadata?: {
    vpcId?: string
    rulesCount?: number
    description?: string
    inboundRules?: { protocol: string; port: string; source: string; description: string }[]
    outboundRules?: { protocol: string; port: string; destination: string; description: string }[]
  }
}


function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Shield className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No security groups found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        No firewall rules or security groups have been configured yet.
      </p>
    </div>
  )
}

function SecurityGroupRow({ sg }: { sg: SecurityGroup }) {
  const [expanded, setExpanded] = useState(false)
  const meta = sg.metadata ?? {}
  const inbound = meta.inboundRules ?? []
  const outbound = meta.outboundRules ?? []

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <CardTitle className="text-base">{sg.name}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Cloud className="h-3 w-3" />
                <span className="uppercase text-xs">{sg.provider}</span>
                {meta.vpcId && (
                  <span className="font-mono text-xs">{meta.vpcId}</span>
                )}
                <span className="text-xs">
                  {meta.rulesCount ?? inbound.length + outbound.length} rules
                </span>
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs text-muted-foreground">
              {meta.description ?? "Security group"}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" /> Edit Rules
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-6">
          <div>
            <p className="text-sm font-medium mb-2">Inbound Rules</p>
            <div className="rounded-md border">
              <div className="grid grid-cols-4 gap-4 p-3 bg-muted text-sm font-medium">
                <span>Protocol</span>
                <span>Port</span>
                <span>Source</span>
                <span>Description</span>
              </div>
              {inbound.map((rule, i) => (
                <div key={i} className="grid grid-cols-4 gap-4 p-3 text-sm border-t">
                  <Badge variant="outline" className="w-fit">{rule.protocol}</Badge>
                  <span className="font-mono">{rule.port}</span>
                  <span className="font-mono text-muted-foreground">{rule.source}</span>
                  <span className="text-muted-foreground">{rule.description}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Outbound Rules</p>
            <div className="rounded-md border">
              <div className="grid grid-cols-4 gap-4 p-3 bg-muted text-sm font-medium">
                <span>Protocol</span>
                <span>Port</span>
                <span>Destination</span>
                <span>Description</span>
              </div>
              {outbound.map((rule, i) => (
                <div key={i} className="grid grid-cols-4 gap-4 p-3 text-sm border-t">
                  <Badge variant="outline" className="w-fit">{rule.protocol}</Badge>
                  <span className="font-mono">{rule.port}</span>
                  <span className="font-mono text-muted-foreground">{rule.destination}</span>
                  <span className="text-muted-foreground">{rule.description}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export default function FirewallPage() {
  const { data, isLoading } = useResources("networking/firewall")
  const [providerFilter, setProviderFilter] = useState<string>("all")

  const securityGroups = (data?.resources ?? []) as SecurityGroup[]

  const filtered = useMemo(() => {
    return securityGroups.filter((sg) => {
      if (providerFilter !== "all" && sg.provider !== providerFilter) return false
      return true
    })
  }, [securityGroups, providerFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Firewall / Security Groups</h1>
        <p className="text-muted-foreground mt-1">
          Manage security groups and firewall rules across providers.
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : securityGroups.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="text-sm">Filters:</span>
            </div>
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
            <span className="text-sm text-muted-foreground">
              {filtered.length} security group{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-4">
            {filtered.map((sg) => (
              <SecurityGroupRow key={sg.id} sg={sg} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
