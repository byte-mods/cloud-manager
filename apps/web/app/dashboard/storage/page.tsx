"use client"

import { useState } from "react"
import Link from "next/link"
import {
  HardDrive,
  FolderOpen,
  Database,
  Archive,
  Shield,
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
    key: "object",
    label: "Object Storage",
    icon: FolderOpen,
    href: "/dashboard/storage/object",
    description: "S3, GCS, and Azure Blob buckets",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    key: "file",
    label: "File Storage",
    icon: HardDrive,
    href: "/dashboard/storage/file",
    description: "EFS, Filestore, Azure Files",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    key: "block",
    label: "Block Storage",
    icon: Database,
    href: "/dashboard/storage/block",
    description: "EBS, Persistent Disks, Managed Disks",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    key: "archive",
    label: "Archive",
    icon: Archive,
    href: "/dashboard/storage/archive",
    description: "Glacier, Coldline, Archive Storage",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  {
    key: "backup",
    label: "Backups",
    icon: Shield,
    href: "/dashboard/storage/backup",
    description: "Backup plans and recovery points",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
]

function ResourceCountCard({
  section,
}: {
  section: (typeof resourceSections)[number]
}) {
  const { data, isLoading } = useResources(`storage/${section.key}`)

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
      title: "Create Bucket",
      href: "/dashboard/storage/object/create",
      icon: Plus,
    },
    {
      title: "View Backups",
      href: "/dashboard/storage/backup",
      icon: Shield,
    },
    {
      title: "Block Volumes",
      href: "/dashboard/storage/block",
      icon: Database,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common storage operations</CardDescription>
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

export default function StorageOverviewPage() {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Storage</h1>
        <p className="text-muted-foreground mt-1">
          Manage your storage resources across all cloud providers.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="object">Object</TabsTrigger>
          <TabsTrigger value="file">File</TabsTrigger>
          <TabsTrigger value="block">Block</TabsTrigger>
          <TabsTrigger value="archive">Archive</TabsTrigger>
          <TabsTrigger value="backup">Backups</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {resourceSections.map((section) => (
              <ResourceCountCard key={section.key} section={section} />
            ))}
          </div>
          <QuickLinksSection />
        </TabsContent>

        <TabsContent value="object">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Object Storage</CardTitle>
                <CardDescription>
                  S3 buckets, GCS buckets, and Azure Blob containers
                </CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/storage/object">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Badge>Active: 24</Badge>
                <Badge variant="secondary">Versioned: 12</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="file">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>File Storage</CardTitle>
                <CardDescription>
                  Managed file systems across EFS, Filestore, and Azure Files
                </CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/storage/file">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="block">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Block Storage</CardTitle>
                <CardDescription>
                  EBS volumes, Persistent Disks, and Managed Disks
                </CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/storage/block">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="archive">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Archive Storage</CardTitle>
                <CardDescription>
                  Glacier, Coldline, and Archive tiers
                </CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/storage/archive">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Backup Management</CardTitle>
                <CardDescription>
                  Backup plans, schedules, and recovery points
                </CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/storage/backup">
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
