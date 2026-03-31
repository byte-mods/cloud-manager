"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Database,
  Server,
  Layers,
  Zap,
  Warehouse,
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
    key: "relational",
    label: "Relational",
    icon: Database,
    href: "/dashboard/databases/relational",
    description: "MySQL, PostgreSQL, SQL Server instances",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    key: "nosql",
    label: "NoSQL",
    icon: Layers,
    href: "/dashboard/databases/nosql",
    description: "DynamoDB, Firestore, Cosmos DB",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    key: "cache",
    label: "Cache",
    icon: Zap,
    href: "/dashboard/databases/cache",
    description: "Redis, Memcached clusters",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    key: "warehouse",
    label: "Data Warehouse",
    icon: Warehouse,
    href: "/dashboard/databases/warehouse",
    description: "Redshift, BigQuery, Synapse",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
]

function ResourceCountCard({
  section,
}: {
  section: (typeof resourceSections)[number]
}) {
  const { data, isLoading } = useResources(`databases/${section.key}`)

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
    { title: "Create Database", href: "/dashboard/databases/relational/create", icon: Plus },
    { title: "NoSQL Tables", href: "/dashboard/databases/nosql", icon: Layers },
    { title: "Cache Clusters", href: "/dashboard/databases/cache", icon: Zap },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common database operations</CardDescription>
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

export default function DatabasesOverviewPage() {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Databases</h1>
        <p className="text-muted-foreground mt-1">
          Manage your database resources across all cloud providers.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="relational">Relational</TabsTrigger>
          <TabsTrigger value="nosql">NoSQL</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="warehouse">Data Warehouse</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {resourceSections.map((section) => (
              <ResourceCountCard key={section.key} section={section} />
            ))}
          </div>
          <QuickLinksSection />
        </TabsContent>

        <TabsContent value="relational">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Relational Databases</CardTitle>
                <CardDescription>
                  MySQL, PostgreSQL, and SQL Server instances
                </CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/databases/relational">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Badge>Running: 12</Badge>
                <Badge variant="secondary">Stopped: 3</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nosql">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>NoSQL Databases</CardTitle>
                <CardDescription>Document, key-value, and graph databases</CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/databases/nosql">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="cache">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>In-Memory Caches</CardTitle>
                <CardDescription>Redis and Memcached clusters</CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/databases/cache">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="warehouse">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Data Warehouses</CardTitle>
                <CardDescription>Redshift, BigQuery, and Synapse</CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/databases/warehouse">
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
