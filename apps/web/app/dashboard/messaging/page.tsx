"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  MessageSquare,
  Radio,
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
import { Skeleton } from "@/components/ui/skeleton"
import { useResources } from "@/hooks/use-resources"

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  )
}

export default function MessagingPage() {
  const { data: queuesData, isLoading: queuesLoading } = useResources("messaging/queues")
  const { data: topicsData, isLoading: topicsLoading } = useResources("messaging/topics")

  const isLoading = queuesLoading || topicsLoading
  const queuesCount = queuesData?.total ?? 0
  const topicsCount = topicsData?.total ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Messaging</h1>
          <p className="text-muted-foreground mt-1">
            Manage message queues and notification topics across all providers.
          </p>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/dashboard/messaging/queues">
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <CardTitle>Queues</CardTitle>
                </div>
                <CardDescription>
                  Manage message queues (SQS, Pub/Sub, Service Bus)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{queuesCount}</p>
                <p className="text-sm text-muted-foreground">Total queues</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/messaging/topics">
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Radio className="h-5 w-5 text-primary" />
                  <CardTitle>Topics</CardTitle>
                </div>
                <CardDescription>
                  Manage notification topics (SNS, Pub/Sub Topics, Event Grid)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{topicsCount}</p>
                <p className="text-sm text-muted-foreground">Total topics</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}
    </div>
  )
}
