"use client"

import { useProfile } from "@/hooks/use-settings"
import Link from "next/link"
import {
  User,
  Building2,
  Cloud,
  Key,
  ArrowRight,
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

const settingsSections = [
  {
    title: "Profile",
    description: "Manage your personal information, avatar, and password.",
    icon: User,
    href: "/dashboard/settings/profile",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Organization",
    description: "Manage your organization, team members, and roles.",
    icon: Building2,
    href: "/dashboard/settings/organization",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    title: "Cloud Accounts",
    description: "Connect and manage AWS, GCP, and Azure accounts.",
    icon: Cloud,
    href: "/dashboard/settings/cloud-accounts",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    title: "API Keys",
    description: "Generate and manage API keys for programmatic access.",
    icon: Key,
    href: "/dashboard/settings/api-keys",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
]

export default function SettingsPage() {
  const { data: profile } = useProfile()

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6" />
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Manage your account, organization, and integrations.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {settingsSections.map((section) => (
          <Card key={section.title} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className={`rounded-lg p-3 w-fit ${section.bgColor}`}>
                <section.icon className={`h-6 w-6 ${section.color}`} />
              </div>
              <CardTitle className="mt-3">{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href={section.href}>
                  Manage {section.title}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
