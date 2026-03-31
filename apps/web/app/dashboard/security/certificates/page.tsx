"use client"

import { useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  ShieldCheck,
  Plus,
  MoreHorizontal,
  Trash2,
  RefreshCw,
  Cloud,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
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
import { useCertificates } from "@/hooks/use-security"

type Certificate = {
  id: string
  domain: string
  provider: string
  status: "active" | "expired" | "pending" | "revoked"
  issuedAt: string
  expiresAt: string
  type: "ACM" | "Let's Encrypt" | "Self-signed" | "DigiCert"
  autoRenewal: boolean
  daysUntilExpiry: number
  sans: string[]
}


const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  expired: "destructive",
  pending: "outline",
  revoked: "destructive",
}

function ExpiryBadge({ days }: { days: number }) {
  if (days <= 0) return <Badge variant="destructive">Expired</Badge>
  if (days <= 14) return (
    <Badge variant="destructive" className="gap-1">
      <AlertTriangle className="h-3 w-3" /> {days}d left
    </Badge>
  )
  if (days <= 30) return (
    <Badge variant="secondary" className="gap-1">
      <AlertTriangle className="h-3 w-3" /> {days}d left
    </Badge>
  )
  return <span className="text-sm text-muted-foreground">{days}d left</span>
}

const columns: ColumnDef<Certificate>[] = [
  { accessorKey: "domain", header: "Domain", cell: ({ row }) => (
    <div>
      <span className="font-medium">{row.original.domain}</span>
      {row.original.sans.length > 1 && (
        <p className="text-xs text-muted-foreground">+{row.original.sans.length - 1} SANs</p>
      )}
    </div>
  )},
  { accessorKey: "provider", header: "Provider", cell: ({ row }) => (
    <div className="flex items-center gap-2">
      <Cloud className="h-4 w-4" />
      <span className="uppercase text-xs font-medium">{row.original.provider}</span>
    </div>
  )},
  { accessorKey: "status", header: "Status", cell: ({ row }) => (
    <Badge variant={statusVariants[row.original.status]}>{row.original.status}</Badge>
  )},
  { accessorKey: "issuedAt", header: "Issued" },
  { accessorKey: "expiresAt", header: "Expires", cell: ({ row }) => (
    <div className="space-y-1">
      <span className="text-sm">{row.original.expiresAt}</span>
      {row.original.status !== "pending" && (
        <div><ExpiryBadge days={row.original.daysUntilExpiry} /></div>
      )}
    </div>
  )},
  { accessorKey: "type", header: "Type", cell: ({ row }) => (
    <Badge variant="outline">{row.original.type}</Badge>
  )},
  { id: "autoRenewal", header: "Auto-Renew", cell: ({ row }) => (
    row.original.autoRenewal
      ? <CheckCircle2 className="h-4 w-4 text-green-500" />
      : <span className="text-sm text-muted-foreground">No</span>
  )},
  { id: "actions", header: "", cell: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem><RefreshCw className="mr-2 h-4 w-4" /> Renew</DropdownMenuItem>
        <DropdownMenuItem><Download className="mr-2 h-4 w-4" /> Download</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Revoke</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )},
]

function CreateCertificateDialog() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Request Certificate</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Certificate</DialogTitle>
          <DialogDescription>Request a new SSL/TLS certificate.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="cert-domain">Domain Name</Label>
            <Input id="cert-domain" placeholder="*.example.com" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cert-sans">Subject Alternative Names (comma-separated)</Label>
            <Input id="cert-sans" placeholder="example.com, www.example.com" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cert-provider">Provider</Label>
            <Select>
              <SelectTrigger id="cert-provider"><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aws">AWS (ACM)</SelectItem>
                <SelectItem value="gcp">GCP</SelectItem>
                <SelectItem value="azure">Azure</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cert-type">Certificate Type</Label>
            <Select>
              <SelectTrigger id="cert-type"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="acm">ACM (AWS)</SelectItem>
                <SelectItem value="letsencrypt">Let&apos;s Encrypt</SelectItem>
                <SelectItem value="digicert">DigiCert</SelectItem>
                <SelectItem value="self-signed">Self-signed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>Request Certificate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No certificates found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Request your first SSL/TLS certificate.
      </p>
    </div>
  )
}

export default function CertificatesPage() {
  const { data, isLoading } = useCertificates()

  // Transform API data to UI format
  const apiCerts = data?.certificates ?? []
  const certificates: Certificate[] = apiCerts.map((cert) => {
      const now = new Date()
      const expires = new Date(cert.validUntil)
      const daysUntilExpiry = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return {
        id: cert.id,
        domain: cert.domain,
        provider: cert.provider.toLowerCase(),
        status: cert.status === 'valid' ? 'active' : cert.status === 'expiring' ? 'active' : cert.status,
        issuedAt: cert.validFrom.split('T')[0],
        expiresAt: cert.validUntil.split('T')[0],
        type: cert.issuer === 'Amazon' ? 'ACM' : cert.issuer === 'Let\'s Encrypt' ? 'Let\'s Encrypt' : cert.issuer === 'DigiCert' ? 'DigiCert' : 'Self-signed',
        autoRenewal: true,
        daysUntilExpiry,
        sans: [cert.domain],
      }
    })

  const expiringCount = certificates.filter((c) => c.daysUntilExpiry > 0 && c.daysUntilExpiry <= 30).length
  const expiredCount = certificates.filter((c) => c.daysUntilExpiry <= 0 && c.status !== "pending").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Certificate Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage SSL/TLS certificates across all providers.
          </p>
        </div>
        <CreateCertificateDialog />
      </div>

      {(expiringCount > 0 || expiredCount > 0) && (
        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="font-medium">Certificate Attention Needed</p>
                <p className="text-sm text-muted-foreground">
                  {expiredCount > 0 && <span className="text-red-500 font-medium">{expiredCount} expired</span>}
                  {expiredCount > 0 && expiringCount > 0 && " and "}
                  {expiringCount > 0 && <span className="text-orange-500 font-medium">{expiringCount} expiring within 30 days</span>}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <LoadingSkeleton />
      ) : certificates.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Certificates ({certificates.length})</CardTitle>
            <CardDescription>SSL/TLS certificates across all providers</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={certificates} searchKey="domain" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
