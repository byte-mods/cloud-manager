"use client"

import { useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Container,
  Plus,
  MoreHorizontal,
  Eye,
  Play,
  Trash2,
  Shield,
  AlertTriangle,
  CheckCircle2,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useContainerScans } from "@/hooks/use-container-scans"
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

type ContainerImage = {
  id: string
  name: string
  tag: string
  registry: string
  lastScanned: string | null
  status: "clean" | "vulnerable" | "scanning" | "unscanned"
  vulnerabilities: { critical: number; high: number; medium: number; low: number }
  size: string
}

// Mock data removed — uses useContainerScans() hook

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  clean: { label: "Clean", variant: "default" },
  vulnerable: { label: "Vulnerable", variant: "destructive" },
  scanning: { label: "Scanning", variant: "secondary" },
  unscanned: { label: "Unscanned", variant: "outline" },
}

const columns: ColumnDef<ContainerImage>[] = [
  {
    accessorKey: "name",
    header: "Image",
    cell: ({ row }) => (
      <div>
        <span className="font-medium">{row.original.name}</span>
        <span className="text-muted-foreground">:{row.original.tag}</span>
      </div>
    ),
  },
  {
    accessorKey: "registry",
    header: "Registry",
    cell: ({ row }) => <Badge variant="outline">{row.original.registry}</Badge>,
  },
  {
    accessorKey: "size",
    header: "Size",
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.size}</span>,
  },
  {
    id: "vulnerabilities",
    header: "Vulnerabilities",
    cell: ({ row }) => {
      const v = row.original.vulnerabilities
      const total = v.critical + v.high + v.medium + v.low
      if (row.original.status === "unscanned" || row.original.status === "scanning") {
        return <span className="text-sm text-muted-foreground">N/A</span>
      }
      return (
        <div className="flex items-center gap-1">
          {v.critical > 0 && <Badge variant="destructive" className="text-xs">{v.critical}C</Badge>}
          {v.high > 0 && <Badge className="text-xs bg-orange-500">{v.high}H</Badge>}
          {v.medium > 0 && <Badge variant="secondary" className="text-xs">{v.medium}M</Badge>}
          {v.low > 0 && <Badge variant="outline" className="text-xs">{v.low}L</Badge>}
          <span className="text-xs text-muted-foreground ml-1">({total})</span>
        </div>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const config = statusConfig[row.original.status]
      return <Badge variant={config.variant}>{config.label}</Badge>
    },
  },
  {
    accessorKey: "lastScanned",
    header: "Last Scanned",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.lastScanned ? new Date(row.original.lastScanned).toLocaleDateString() : "Never"}
      </span>
    ),
  },
  {
    id: "actions",
    header: "",
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
          <DropdownMenuItem><Play className="mr-2 h-4 w-4" /> Scan Now</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Remove</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

function ScanImageDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Play className="mr-2 h-4 w-4" /> Scan Image</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Scan Container Image</DialogTitle>
          <DialogDescription>Trigger a vulnerability scan on a container image.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="image-name">Image Name</Label>
            <Input id="image-name" placeholder="my-app:latest" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="registry">Registry</Label>
            <Select>
              <SelectTrigger id="registry"><SelectValue placeholder="Select registry" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ecr">Amazon ECR</SelectItem>
                <SelectItem value="gcr">Google GCR</SelectItem>
                <SelectItem value="acr">Azure ACR</SelectItem>
                <SelectItem value="dockerhub">Docker Hub</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="scan-type">Scan Type</Label>
            <Select>
              <SelectTrigger id="scan-type"><SelectValue placeholder="Select scan type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Scan</SelectItem>
                <SelectItem value="quick">Quick Scan</SelectItem>
                <SelectItem value="compliance">Compliance Check</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}><Play className="mr-2 h-4 w-4" /> Start Scan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ContainerScanPage() {
  const { data: scansData } = useContainerScans()
  const images: ContainerImage[] = (scansData?.scans ?? []) as any[]
  const totalVulnerabilities = images.reduce((acc, img) => acc + img.vulnerabilities.critical + img.vulnerabilities.high + img.vulnerabilities.medium + img.vulnerabilities.low, 0)
  const criticalCount = images.reduce((acc, img) => acc + img.vulnerabilities.critical, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Container Scanning</h1>
          <p className="text-muted-foreground mt-1">Scan container images for vulnerabilities and compliance issues.</p>
        </div>
        <ScanImageDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Images</CardDescription>
            <CardTitle className="text-3xl">{images.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Vulnerabilities</CardDescription>
            <CardTitle className="text-3xl text-orange-500">{totalVulnerabilities}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Critical</CardDescription>
            <CardTitle className="text-3xl text-red-500">{criticalCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Clean Images</CardDescription>
            <CardTitle className="text-3xl text-green-500">{images.filter((i) => i.status === "clean").length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Container Images</CardTitle>
          <CardDescription>All registered container images and their scan results</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={images} searchKey="name" />
        </CardContent>
      </Card>
    </div>
  )
}
