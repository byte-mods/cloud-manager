"use client"

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Shield,
  Plus,
  MoreHorizontal,
  Trash2,
  Cloud,
  Filter,
  Eye,
  Settings,
  ChevronDown,
  ChevronRight,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useResources, type Resource } from "@/hooks/use-resources"

type SecurityGroupRule = {
  direction: "inbound" | "outbound"
  protocol: string
  portRange: string
  source: string
  description?: string
}

type SecurityGroup = Resource & {
  metadata?: {
    vpcId?: string
    inboundRules?: SecurityGroupRule[]
    outboundRules?: SecurityGroupRule[]
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  available: "default",
  creating: "outline",
  deleting: "destructive",
}

function RulesTable({ rules, direction }: { rules: SecurityGroupRule[]; direction: string }) {
  return (
    <div className="p-4 bg-muted/50 rounded-md">
      <h4 className="text-sm font-semibold mb-2 capitalize">{direction} Rules</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Protocol</TableHead>
            <TableHead>Port Range</TableHead>
            <TableHead>Source/Destination</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No {direction} rules
              </TableCell>
            </TableRow>
          ) : (
            rules.map((rule, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-mono text-sm">{rule.protocol}</TableCell>
                <TableCell className="font-mono text-sm">{rule.portRange}</TableCell>
                <TableCell className="font-mono text-sm">{rule.source}</TableCell>
                <TableCell className="text-sm">{rule.description ?? "-"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default function SecurityGroupsPage() {
  const { data, isLoading } = useResources("networking/security-groups")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [addRuleDialogOpen, setAddRuleDialogOpen] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Add Rule form state
  const [ruleDirection, setRuleDirection] = useState<string>("inbound")
  const [ruleProtocol, setRuleProtocol] = useState("")
  const [rulePortRange, setRulePortRange] = useState("")
  const [ruleSourceCidr, setRuleSourceCidr] = useState("")
  const [ruleDescription, setRuleDescription] = useState("")

  const securityGroups = (data?.resources ?? []) as SecurityGroup[]

  const filtered = useMemo(() => {
    return securityGroups.filter((sg) => {
      if (providerFilter !== "all" && sg.provider !== providerFilter) return false
      if (regionFilter !== "all" && sg.region !== regionFilter) return false
      return true
    })
  }, [securityGroups, providerFilter, regionFilter])

  const regions = useMemo(
    () => [...new Set(securityGroups.map((s) => s.region))],
    [securityGroups]
  )

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const columns: ColumnDef<SecurityGroup>[] = [
    {
      id: "expand",
      header: "",
      cell: ({ row }) => {
        const isExpanded = expandedRows.has(row.original.id)
        return (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => toggleRow(row.original.id)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        )
      },
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "provider",
      header: "Provider",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4" />
          <span className="uppercase text-xs font-medium">{row.original.provider}</span>
        </div>
      ),
    },
    {
      accessorKey: "region",
      header: "Region",
    },
    {
      id: "vpc",
      header: "VPC",
      cell: ({ row }) => (
        <span className="text-sm font-mono">
          {row.original.metadata?.vpcId ?? "-"}
        </span>
      ),
    },
    {
      id: "inboundRules",
      header: "Inbound Rules",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.metadata?.inboundRules?.length ?? 0}
        </span>
      ),
    },
    {
      id: "outboundRules",
      header: "Outbound Rules",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.metadata?.outboundRules?.length ?? 0}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Eye className="mr-2 h-4 w-4" /> View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAddRuleDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Rule
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Groups</h1>
          <p className="text-muted-foreground mt-1">
            Manage security groups and firewall rules for your resources.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={addRuleDialogOpen} onOpenChange={setAddRuleDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Security Group Rule</DialogTitle>
                <DialogDescription>
                  Add a new inbound or outbound rule to a security group.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="rule-direction">Direction</Label>
                  <Select value={ruleDirection} onValueChange={setRuleDirection}>
                    <SelectTrigger id="rule-direction">
                      <SelectValue placeholder="Select direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rule-protocol">Protocol</Label>
                  <Select value={ruleProtocol} onValueChange={setRuleProtocol}>
                    <SelectTrigger id="rule-protocol">
                      <SelectValue placeholder="Select protocol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tcp">TCP</SelectItem>
                      <SelectItem value="udp">UDP</SelectItem>
                      <SelectItem value="icmp">ICMP</SelectItem>
                      <SelectItem value="all">All Traffic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rule-port">Port Range</Label>
                  <Input
                    id="rule-port"
                    placeholder="e.g. 80, 443, 8080-8090"
                    value={rulePortRange}
                    onChange={(e) => setRulePortRange(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rule-source">Source CIDR</Label>
                  <Input
                    id="rule-source"
                    placeholder="e.g. 0.0.0.0/0"
                    value={ruleSourceCidr}
                    onChange={(e) => setRuleSourceCidr(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rule-desc">Description</Label>
                  <Input
                    id="rule-desc"
                    placeholder="Optional description"
                    value={ruleDescription}
                    onChange={(e) => setRuleDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddRuleDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setAddRuleDialogOpen(false)}>
                  Add Rule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Security Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Security Group</DialogTitle>
                <DialogDescription>
                  Create a new security group for controlling traffic.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="sg-provider">Provider</Label>
                  <Select>
                    <SelectTrigger id="sg-provider">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aws">AWS</SelectItem>
                      <SelectItem value="gcp">GCP</SelectItem>
                      <SelectItem value="azure">Azure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sg-name">Name</Label>
                  <Input id="sg-name" placeholder="e.g. web-server-sg" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sg-vpc">VPC ID</Label>
                  <Input id="sg-vpc" placeholder="e.g. vpc-0abc123def456" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sg-desc">Description</Label>
                  <Input id="sg-desc" placeholder="Security group description" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setDialogOpen(false)}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="flex gap-4">
            <Skeleton className="h-10 w-[180px]" />
            <Skeleton className="h-10 w-[180px]" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : securityGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No Security Groups found</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">
            Create a security group to control inbound and outbound traffic.
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Security Group
          </Button>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filtered.length} Security Group{filtered.length !== 1 ? "s" : ""}
            </CardTitle>
            <CardDescription>
              <div className="flex flex-wrap items-center gap-3 mt-2">
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
                <Select value={regionFilter} onValueChange={setRegionFilter}>
                  <SelectTrigger className="w-[160px] h-8">
                    <SelectValue placeholder="Region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    {regions.map((region) => (
                      <SelectItem key={region} value={region}>
                        {region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DataTable columns={columns} data={filtered} searchKey="name" />
            {filtered
              .filter((sg) => expandedRows.has(sg.id))
              .map((sg) => (
                <div key={sg.id} className="ml-8 space-y-3">
                  <p className="text-sm font-medium">Rules for {sg.name}:</p>
                  <RulesTable rules={sg.metadata?.inboundRules ?? []} direction="inbound" />
                  <RulesTable rules={sg.metadata?.outboundRules ?? []} direction="outbound" />
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
