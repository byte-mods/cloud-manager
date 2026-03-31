"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Network,
  Globe,
  Router,
  Shield,
  Link2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { useResources, type Resource } from "@/hooks/use-resources"

type VPCDetail = Resource & {
  metadata?: {
    cidr?: string
    subnets?: number
    dnsResolution?: boolean
    dnsHostnames?: boolean
    dhcpOptions?: string
    tenancy?: string
    isDefault?: boolean
  }
}

type Subnet = {
  id: string
  name: string
  cidr: string
  az: string
  type: "public" | "private"
  routeTable: string
  availableIps: number
}

type RouteTable = {
  id: string
  name: string
  routes: { destination: string; target: string }[]
  associations: string[]
}

type Gateway = {
  id: string
  name: string
  type: "internet" | "nat"
  status: string
  subnet?: string
}

type Peering = {
  id: string
  name: string
  peerVpc: string
  peerRegion: string
  status: string
}


function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Network className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">VPC not found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        The requested VPC could not be found or has been deleted.
      </p>
      <Button asChild>
        <Link href="/dashboard/networking/vpc">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to VPCs
        </Link>
      </Button>
    </div>
  )
}

export default function VPCDetailPage() {
  const params = useParams()
  const router = useRouter()
  const vpcId = params.id as string
  const { data, isLoading } = useResources("networking/vpc")

  const vpc = (data?.resources ?? []).find(
    (r) => r.id === vpcId
  ) as VPCDetail | undefined

  if (isLoading) return <LoadingSkeleton />
  if (!vpc) return <EmptyState />

  const meta = vpc.metadata ?? {}

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/networking/vpc")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{vpc.name}</h1>
            <Badge variant="default">{vpc.status}</Badge>
            {meta.isDefault && <Badge variant="outline">Default</Badge>}
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-sm">{vpc.id}</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="topology">Topology</TabsTrigger>
          <TabsTrigger value="subnets">Subnets</TabsTrigger>
          <TabsTrigger value="route-tables">Route Tables</TabsTrigger>
          <TabsTrigger value="gateways">Gateways</TabsTrigger>
          <TabsTrigger value="peering">Peering</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>VPC Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">CIDR Block</p>
                  <p className="text-sm font-medium font-mono">{meta.cidr ?? "10.0.0.0/16"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Provider</p>
                  <p className="text-sm font-medium uppercase">{vpc.provider}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Region</p>
                  <p className="text-sm font-medium">{vpc.region}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">DNS Resolution</p>
                  <Badge variant={meta.dnsResolution !== false ? "default" : "secondary"}>
                    {meta.dnsResolution !== false ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">DNS Hostnames</p>
                  <Badge variant={meta.dnsHostnames ? "default" : "secondary"}>
                    {meta.dnsHostnames ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">DHCP Options Set</p>
                  <p className="text-sm font-medium font-mono">{meta.dhcpOptions ?? "default"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tenancy</p>
                  <p className="text-sm font-medium">{meta.tenancy ?? "default"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Subnets</p>
                  <p className="text-sm font-medium">{meta.subnets ?? 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-sm font-medium">{vpc.createdAt}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="topology" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Network Topology</CardTitle>
              <CardDescription>
                Visual representation of the VPC network architecture
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 min-h-[400px] flex flex-col items-center justify-center">
                <div className="w-full max-w-3xl space-y-6">
                  {/* Internet Gateway */}
                  <div className="flex justify-center">
                    <div className="rounded-lg border-2 border-blue-500 bg-blue-500/10 px-6 py-3 text-center">
                      <Globe className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                      <p className="text-sm font-medium">Internet Gateway</p>
                      <p className="text-xs text-muted-foreground font-mono">igw-abc123</p>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <div className="h-8 w-0.5 bg-muted-foreground/25" />
                  </div>
                  {/* VPC Box */}
                  <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-6">
                    <p className="text-sm font-medium mb-4">VPC: {meta.cidr ?? "10.0.0.0/16"}</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Public Subnets */}
                      <div className="rounded-lg border border-green-500/50 bg-green-500/5 p-4">
                        <p className="text-xs font-medium text-green-600 mb-3">Public Subnets</p>
                        <div className="text-center py-4 text-xs text-muted-foreground">No data available</div>
                      </div>
                      {/* Private Subnets */}
                      <div className="rounded-lg border border-orange-500/50 bg-orange-500/5 p-4">
                        <p className="text-xs font-medium text-orange-600 mb-3">Private Subnets</p>
                        <div className="text-center py-4 text-xs text-muted-foreground">No data available</div>
                      </div>
                    </div>
                    {/* NAT Gateway inside VPC */}
                    <div className="mt-4 flex justify-center">
                      <div className="rounded border border-purple-500/50 bg-purple-500/10 px-4 py-2 text-center">
                        <Router className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                        <p className="text-xs font-medium">NAT Gateway</p>
                        <p className="text-xs text-muted-foreground font-mono">nat-def456</p>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Interactive D3.js topology visualization placeholder
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subnets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Subnets</CardTitle>
              <CardDescription>
                Subnets configured in this VPC
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-sm text-muted-foreground">No data available</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="route-tables" className="space-y-4">
          <div className="text-center py-12 text-sm text-muted-foreground">No data available</div>
        </TabsContent>

        <TabsContent value="gateways" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Internet & NAT Gateways</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-sm text-muted-foreground">No data available</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="peering" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Peering Connections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-sm text-muted-foreground">No data available</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
