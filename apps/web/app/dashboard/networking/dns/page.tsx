"use client"

import { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Globe,
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

type DNSRecord = {
  name: string
  type: string
  ttl: number
  value: string
}

type DNSZone = Resource & {
  metadata?: {
    zoneType?: "public" | "private"
    records?: DNSRecord[]
    recordCount?: number
  }
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  available: "default",
  creating: "outline",
  deleting: "destructive",
  pending: "outline",
}

function RecordsTable({ records }: { records: DNSRecord[] }) {
  return (
    <div className="p-4 bg-muted/50 rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>TTL</TableHead>
            <TableHead>Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No records
              </TableCell>
            </TableRow>
          ) : (
            records.map((record, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-mono text-sm">{record.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{record.type}</Badge>
                </TableCell>
                <TableCell className="text-sm">{record.ttl}s</TableCell>
                <TableCell className="font-mono text-sm max-w-[300px] truncate">
                  {record.value}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default function DNSPage() {
  const { data, isLoading } = useResources("networking/dns")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [addRecordDialogOpen, setAddRecordDialogOpen] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Add Record form state
  const [recordName, setRecordName] = useState("")
  const [recordType, setRecordType] = useState("")
  const [recordTtl, setRecordTtl] = useState("300")
  const [recordValue, setRecordValue] = useState("")

  const dnsZones = (data?.resources ?? []) as DNSZone[]

  const filtered = useMemo(() => {
    return dnsZones.filter((zone) => {
      if (providerFilter !== "all" && zone.provider !== providerFilter) return false
      if (regionFilter !== "all" && zone.region !== regionFilter) return false
      return true
    })
  }, [dnsZones, providerFilter, regionFilter])

  const regions = useMemo(
    () => [...new Set(dnsZones.map((z) => z.region))],
    [dnsZones]
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

  const columns: ColumnDef<DNSZone>[] = [
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
      header: "Zone Name",
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
      id: "zoneType",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant={row.original.metadata?.zoneType === "public" ? "default" : "secondary"}>
          {row.original.metadata?.zoneType ?? "public"}
        </Badge>
      ),
    },
    {
      id: "recordCount",
      header: "Records Count",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.metadata?.recordCount ?? row.original.metadata?.records?.length ?? 0}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status
        return (
          <Badge variant={statusVariants[status] ?? "outline"}>
            {status}
          </Badge>
        )
      },
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
            <DropdownMenuItem onClick={() => setAddRecordDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Record
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Delete Zone
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
          <h1 className="text-3xl font-bold tracking-tight">DNS Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage DNS zones and records across cloud providers.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={addRecordDialogOpen} onOpenChange={setAddRecordDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add DNS Record</DialogTitle>
                <DialogDescription>
                  Add a new DNS record to a hosted zone.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="dns-record-name">Name</Label>
                  <Input
                    id="dns-record-name"
                    placeholder="e.g. www.example.com"
                    value={recordName}
                    onChange={(e) => setRecordName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dns-record-type">Type</Label>
                  <Select value={recordType} onValueChange={setRecordType}>
                    <SelectTrigger id="dns-record-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="AAAA">AAAA</SelectItem>
                      <SelectItem value="CNAME">CNAME</SelectItem>
                      <SelectItem value="MX">MX</SelectItem>
                      <SelectItem value="TXT">TXT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dns-record-ttl">TTL (seconds)</Label>
                  <Input
                    id="dns-record-ttl"
                    placeholder="e.g. 300"
                    value={recordTtl}
                    onChange={(e) => setRecordTtl(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dns-record-value">Value</Label>
                  <Input
                    id="dns-record-value"
                    placeholder="e.g. 192.168.1.1"
                    value={recordValue}
                    onChange={(e) => setRecordValue(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddRecordDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setAddRecordDialogOpen(false)}>
                  Add Record
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Zone
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create DNS Zone</DialogTitle>
                <DialogDescription>
                  Create a new DNS hosted zone.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="dns-zone-name">Zone Name</Label>
                  <Input id="dns-zone-name" placeholder="e.g. example.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dns-zone-provider">Provider</Label>
                  <Select>
                    <SelectTrigger id="dns-zone-provider">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aws">AWS (Route 53)</SelectItem>
                      <SelectItem value="gcp">GCP (Cloud DNS)</SelectItem>
                      <SelectItem value="azure">Azure (DNS)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dns-zone-type">Type</Label>
                  <Select>
                    <SelectTrigger id="dns-zone-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
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
      ) : dnsZones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Globe className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No DNS Zones found</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">
            Create a DNS zone to manage your domain records.
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Zone
          </Button>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filtered.length} DNS Zone{filtered.length !== 1 ? "s" : ""}
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
              .filter((zone) => expandedRows.has(zone.id))
              .map((zone) => (
                <div key={zone.id} className="ml-8">
                  <p className="text-sm font-medium mb-2">Records for {zone.name}:</p>
                  <RecordsTable records={zone.metadata?.records ?? []} />
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
