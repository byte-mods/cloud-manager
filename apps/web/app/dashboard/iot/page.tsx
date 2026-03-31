"use client"

import Link from "next/link"
import { Cpu, Wifi, WifiOff, MessageSquare, Radio, Server, ArrowRight } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useResources } from "@/hooks/use-resources"

const sections = [
  { title: "Devices", href: "/dashboard/iot/devices", icon: Cpu, color: "text-blue-500", bgColor: "bg-blue-500/10", desc: "Manage IoT devices and connectivity" },
  { title: "Digital Twins", href: "/dashboard/iot/twins", icon: Server, color: "text-purple-500", bgColor: "bg-purple-500/10", desc: "Device shadows and state management" },
  { title: "Rules & Routing", href: "/dashboard/iot/rules", icon: Radio, color: "text-green-500", bgColor: "bg-green-500/10", desc: "Message routing and event rules" },
  { title: "Edge Computing", href: "/dashboard/iot/edge", icon: Wifi, color: "text-orange-500", bgColor: "bg-orange-500/10", desc: "Edge devices and deployments" },
]

export default function IoTOverviewPage() {
  const { data: devices } = useResources('iot/things')
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">IoT</h1>
        <p className="text-muted-foreground mt-1">
          Manage IoT devices, digital twins, and edge computing across cloud providers.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Cpu className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,247</div>
            <p className="text-xs text-muted-foreground mt-1">Registered devices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected</CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">1,183</div>
            <p className="text-xs text-muted-foreground mt-1">94.8% connectivity</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline</CardTitle>
            <WifiOff className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">64</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages/sec</CardTitle>
            <MessageSquare className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24.5K</div>
            <p className="text-xs text-muted-foreground mt-1">Message throughput</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className={`rounded-lg p-3 w-fit ${section.bgColor}`}>
                <section.icon className={`h-6 w-6 ${section.color}`} />
              </div>
              <CardTitle className="mt-3">{section.title}</CardTitle>
              <CardDescription>{section.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href={section.href}>Manage<ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
