"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Server,
  Container,
  Cloud,
  Layers,
  Cpu,
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
    key: "instances",
    label: "Instances",
    icon: Server,
    href: "/dashboard/compute/instances",
    description: "Virtual machines across all providers",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    key: "kubernetes",
    label: "Kubernetes",
    icon: Cloud,
    href: "/dashboard/compute/kubernetes",
    description: "Managed Kubernetes clusters (EKS, GKE, AKS)",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    key: "serverless",
    label: "Serverless",
    icon: Cpu,
    href: "/dashboard/compute/serverless",
    description: "Lambda, Cloud Functions, Azure Functions",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    key: "containers",
    label: "Containers",
    icon: Container,
    href: "/dashboard/compute/containers",
    description: "Container registries and services (ECS, Cloud Run)",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  {
    key: "batch",
    label: "Batch",
    icon: Layers,
    href: "/dashboard/compute/batch",
    description: "Batch computing jobs and queues",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
]

function ResourceCountCard({
  section,
}: {
  section: (typeof resourceSections)[number]
}) {
  const { data, isLoading } = useResources(`compute/${section.key}`)

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
    {
      title: "Launch Instance",
      href: "/dashboard/compute/instances/create",
      icon: Plus,
    },
    {
      title: "Create Cluster",
      href: "/dashboard/compute/kubernetes",
      icon: Plus,
    },
    {
      title: "Create Function",
      href: "/dashboard/compute/serverless/create",
      icon: Plus,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common compute operations</CardDescription>
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

export default function ComputeOverviewPage() {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compute</h1>
        <p className="text-muted-foreground mt-1">
          Manage your compute resources across all cloud providers.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="instances">Instances</TabsTrigger>
          <TabsTrigger value="kubernetes">Kubernetes</TabsTrigger>
          <TabsTrigger value="serverless">Serverless</TabsTrigger>
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="batch">Batch</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {resourceSections.map((section) => (
              <ResourceCountCard key={section.key} section={section} />
            ))}
          </div>
          <QuickLinksSection />
        </TabsContent>

        <TabsContent value="instances">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>VM Instances</CardTitle>
                <CardDescription>
                  Virtual machines running across AWS, GCP, and Azure
                </CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/compute/instances">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Badge>Running: 42</Badge>
                <Badge variant="secondary">Stopped: 12</Badge>
                <Badge variant="destructive">Terminated: 3</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kubernetes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Kubernetes Clusters</CardTitle>
                <CardDescription>
                  Managed clusters across EKS, GKE, and AKS
                </CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/compute/kubernetes">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="serverless">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Serverless Functions</CardTitle>
                <CardDescription>
                  Lambda, Cloud Functions, and Azure Functions
                </CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/compute/serverless">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="containers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Container Services</CardTitle>
                <CardDescription>
                  Registries and managed container services
                </CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/compute/containers">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="batch">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Batch Jobs</CardTitle>
                <CardDescription>
                  Batch computing jobs and processing queues
                </CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/compute/batch">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
