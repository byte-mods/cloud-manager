"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Network,
  Globe,
  Shield,
  Radio,
  Lock,
  Zap,
  ArrowRight,
  Plus,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useResources } from "@/hooks/use-resources"

const resourceSections = [
  {
    key: "vpc",
    label: "VPCs",
    icon: Network,
    href: "/dashboard/networking/vpc",
    description: "Virtual private clouds and VNets",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    key: "load-balancers",
    label: "Load Balancers",
    icon: Zap,
    href: "/dashboard/networking/load-balancers",
    description: "ALB, NLB, CLB across providers",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    key: "dns",
    label: "DNS Zones",
    icon: Globe,
    href: "/dashboard/networking/dns",
    description: "Route 53, Cloud DNS, Azure DNS",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    key: "cdn",
    label: "CDN",
    icon: Radio,
    href: "/dashboard/networking/cdn",
    description: "CloudFront, Cloud CDN, Azure CDN",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  {
    key: "firewall",
    label: "Firewalls",
    icon: Shield,
    href: "/dashboard/networking/firewall",
    description: "Security groups and firewall rules",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  {
    key: "vpn",
    label: "VPN",
    icon: Lock,
    href: "/dashboard/networking/vpn",
    description: "Site-to-site and client VPN connections",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
]

function ResourceCountCard({
  section,
}: {
  section: (typeof resourceSections)[number]
}) {
  const { data, isLoading } = useResources(`networking/${section.key}`)

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{section.label}</CardTitle>
        <div className={`rounded-md p-2 ${section.bgColor}`}>
          <section.icon className={`h-4 w-4 ${section.color}`} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-bold">{data?.total ?? 0}</div>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {section.description}
        </p>
        <Button variant="ghost" size="sm" className="mt-3 -ml-2 h-8" asChild>
          <Link href={section.href}>
            View all
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function QuickLinksSection() {
  const quickLinks = [
    { title: "Create VPC", href: "/dashboard/networking/vpc/create", icon: Plus },
    { title: "DNS Zones", href: "/dashboard/networking/dns", icon: Globe },
    { title: "Firewall Rules", href: "/dashboard/networking/firewall", icon: Shield },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common networking operations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {quickLinks.map((link) => (
            <Button
              key={link.title}
              variant="outline"
              className="h-auto justify-start gap-2 p-4"
              asChild
            >
              <Link href={link.href}>
                <link.icon className="h-4 w-4 text-primary" />
                {link.title}
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function NetworkingOverviewPage() {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Networking</h1>
        <p className="text-muted-foreground mt-1">
          Manage your network infrastructure across all cloud providers.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="vpc">VPCs</TabsTrigger>
          <TabsTrigger value="lb">Load Balancers</TabsTrigger>
          <TabsTrigger value="dns">DNS</TabsTrigger>
          <TabsTrigger value="cdn">CDN</TabsTrigger>
          <TabsTrigger value="firewall">Firewalls</TabsTrigger>
          <TabsTrigger value="vpn">VPN</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {resourceSections.map((section) => (
              <ResourceCountCard key={section.key} section={section} />
            ))}
          </div>
          <QuickLinksSection />
        </TabsContent>

        <TabsContent value="vpc">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Virtual Private Clouds</CardTitle>
                <CardDescription>VPCs and VNets across all providers</CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/networking/vpc">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Badge>Active: 8</Badge>
                <Badge variant="secondary">Peered: 3</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lb">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Load Balancers</CardTitle>
                <CardDescription>Application, Network, and Classic load balancers</CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/networking/load-balancers">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="dns">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>DNS Zones</CardTitle>
                <CardDescription>DNS zones and record management</CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/networking/dns">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="cdn">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>CDN Distributions</CardTitle>
                <CardDescription>Content delivery networks</CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/networking/cdn">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="firewall">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Firewall / Security Groups</CardTitle>
                <CardDescription>Network security rules</CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/networking/firewall">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="vpn">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>VPN Connections</CardTitle>
                <CardDescription>Site-to-site and client VPN</CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/networking/vpn">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
