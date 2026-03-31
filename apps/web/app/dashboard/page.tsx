"use client"

import { useCostData } from "@/hooks/use-cost-data"
import {
  Server,
  DollarSign,
  Shield,
  Bell,
  ArrowRight,
  Plus,
  Terminal,
  BarChart3,
  Cloud,
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
import { useAuthStore } from "@/stores/auth-store"

const stats = [
  {
    title: "Total Resources",
    value: "1,284",
    description: "+12 from last week",
    icon: Server,
    color: "text-blue-500",
  },
  {
    title: "Monthly Cost",
    value: "$24,563",
    description: "-3.2% from last month",
    icon: DollarSign,
    color: "text-green-500",
  },
  {
    title: "Security Score",
    value: "94/100",
    description: "2 issues to resolve",
    icon: Shield,
    color: "text-orange-500",
  },
  {
    title: "Active Alerts",
    value: "7",
    description: "3 critical, 4 warning",
    icon: Bell,
    color: "text-red-500",
  },
]

const recentActivity = [
  {
    action: "Instance i-0abc123 started",
    module: "Compute",
    time: "2 minutes ago",
  },
  {
    action: "Security group sg-web updated",
    module: "Networking",
    time: "15 minutes ago",
  },
  {
    action: "Database backup completed",
    module: "Databases",
    time: "1 hour ago",
  },
  {
    action: "New IAM policy created",
    module: "Security",
    time: "3 hours ago",
  },
  {
    action: "Cost alert triggered for S3",
    module: "Cost Management",
    time: "5 hours ago",
  },
]

const quickActions = [
  {
    title: "Launch Instance",
    description: "Deploy a new compute instance",
    icon: Plus,
    href: "/dashboard/compute/instances",
  },
  {
    title: "Open Terminal",
    description: "AI-powered cloud terminal",
    icon: Terminal,
    href: "/dashboard/ai-assistant/terminal",
  },
  {
    title: "View Metrics",
    description: "Monitor infrastructure health",
    icon: BarChart3,
    href: "/dashboard/monitoring/dashboards",
  },
  {
    title: "Manage Cloud Accounts",
    description: "Connect and manage providers",
    icon: Cloud,
    href: "/dashboard/settings/cloud-accounts",
  },
  {
    title: "Cost Explorer",
    description: "Analyze spending and usage",
    icon: DollarSign,
    href: "/dashboard/cost/explorer",
  },
  {
    title: "Settings",
    description: "Configure your workspace",
    icon: Settings,
    href: "/dashboard/settings/profile",
  },
]

export default function DashboardPage() {
  const { totalCost } = useCostData('30d')
  const { user } = useAuthStore()

  return (
    <div className="space-y-8">
      {/* Welcome message */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back{user?.name ? `, ${user.name}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here is an overview of your cloud infrastructure.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest changes across your infrastructure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">{item.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.module}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {quickActions.map((action) => (
                <Button
                  key={action.title}
                  variant="outline"
                  className="h-auto flex-col items-start gap-1 p-4 text-left"
                  asChild
                >
                  <a href={action.href}>
                    <div className="flex items-center gap-2">
                      <action.icon className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">
                        {action.title}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {action.description}
                    </span>
                  </a>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
