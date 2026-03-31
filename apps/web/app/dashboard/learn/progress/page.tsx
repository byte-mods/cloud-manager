"use client"

import Link from "next/link"
import {
  ArrowLeft,
  Trophy,
  Flame,
  Star,
  Award,
  BookOpen,
  Calendar,
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
import { Progress } from "@/components/ui/progress"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

const pathProgress = [
  { name: "Cloud Architect", completed: 7, total: 18, color: "bg-blue-500" },
  { name: "DevOps Engineer", completed: 12, total: 22, color: "bg-green-500" },
  { name: "Data Engineer", completed: 3, total: 16, color: "bg-purple-500" },
  { name: "System Admin", completed: 8, total: 20, color: "bg-orange-500" },
  { name: "Network Admin", completed: 2, total: 14, color: "bg-red-500" },
]

const completedTutorials = [
  { title: "Introduction to Multi-Cloud Architecture", path: "Cloud Architect", completedAt: "Mar 28, 2026" },
  { title: "Designing for High Availability", path: "Cloud Architect", completedAt: "Mar 27, 2026" },
  { title: "Infrastructure as Code with Terraform", path: "DevOps Engineer", completedAt: "Mar 26, 2026" },
  { title: "CI/CD Pipelines with GitHub Actions", path: "DevOps Engineer", completedAt: "Mar 25, 2026" },
  { title: "Cloud Data Fundamentals", path: "Data Engineer", completedAt: "Mar 24, 2026" },
  { title: "Cloud Administration Basics", path: "System Admin", completedAt: "Mar 23, 2026" },
]

const achievements = [
  { title: "First Steps", description: "Complete your first tutorial", icon: Star, earned: true },
  { title: "Quick Learner", description: "Complete 5 tutorials", icon: BookOpen, earned: true },
  { title: "Multi-Path", description: "Start 3 different learning paths", icon: Award, earned: true },
  { title: "Streak Master", description: "7-day study streak", icon: Flame, earned: true },
  { title: "Halfway There", description: "Complete 50% of any path", icon: Trophy, earned: false },
  { title: "Cloud Expert", description: "Complete all tutorials", icon: Trophy, earned: false },
]

// Simple streak calendar
const studyDays = new Set([1, 2, 3, 5, 6, 7, 8, 10, 12, 13, 14, 15, 17, 18, 19, 20, 22, 23, 24, 25, 26, 27, 28, 29])

export default function ProgressPage() {
  const { data: progress } = useQuery({ queryKey: ['learn-progress'], queryFn: () => apiClient.get('/v1/learn/progress') })
  const totalCompleted = pathProgress.reduce((sum, p) => sum + p.completed, 0)
  const totalTutorials = pathProgress.reduce((sum, p) => sum + p.total, 0)
  const overallPercent = totalTutorials > 0 ? Math.round((totalCompleted / totalTutorials) * 100) : 0

  return (
    <div className="space-y-8">
      <Button variant="ghost" asChild>
        <Link href="/dashboard/learn">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Learning Center
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Progress Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Track your learning journey and achievements.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Overall completion circle */}
        <Card className="lg:row-span-2">
          <CardHeader>
            <CardTitle>Overall Progress</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="relative w-40 h-40 mb-4">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="10"
                  strokeDasharray={`${overallPercent * 3.14} ${314 - overallPercent * 3.14}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-bold">{overallPercent}%</div>
                  <div className="text-xs text-muted-foreground">Complete</div>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {totalCompleted} of {totalTutorials} tutorials completed
            </p>
          </CardContent>
        </Card>

        {/* Path-by-path progress */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Path Progress</CardTitle>
            <CardDescription>Completion by learning path</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {pathProgress.map((path) => {
              const pct = path.total > 0 ? Math.round((path.completed / path.total) * 100) : 0
              return (
                <div key={path.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium">{path.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {path.completed}/{path.total} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${path.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Study streak calendar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Study Streak - March 2026
            </CardTitle>
            <CardDescription>
              Current streak: 8 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1.5">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-xs text-muted-foreground py-1">
                  {day}
                </div>
              ))}
              {/* March 2026 starts on Sunday */}
              {Array.from({ length: 31 }).map((_, i) => {
                const day = i + 1
                const isStudied = studyDays.has(day)
                const isToday = day === 29
                return (
                  <div
                    key={day}
                    className={`aspect-square rounded-md flex items-center justify-center text-xs ${
                      isToday
                        ? "bg-primary text-primary-foreground font-bold"
                        : isStudied
                        ? "bg-green-500/20 text-green-500"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {day}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {achievements.map((achievement) => (
              <div
                key={achievement.title}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  achievement.earned ? "bg-yellow-500/5 border-yellow-500/20" : "opacity-50"
                }`}
              >
                <div className={`p-2 rounded-full ${achievement.earned ? "bg-yellow-500/10" : "bg-muted"}`}>
                  <achievement.icon className={`h-5 w-5 ${achievement.earned ? "text-yellow-500" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-sm font-medium">{achievement.title}</p>
                  <p className="text-xs text-muted-foreground">{achievement.description}</p>
                </div>
                {achievement.earned && (
                  <Badge className="ml-auto bg-yellow-500/10 text-yellow-500 text-xs">Earned</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Completed tutorials */}
      <Card>
        <CardHeader>
          <CardTitle>Recently Completed</CardTitle>
          <CardDescription>Your latest completed tutorials</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {completedTutorials.map((tutorial, i) => (
              <div key={i} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{tutorial.title}</p>
                  <p className="text-xs text-muted-foreground">{tutorial.path}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                  {tutorial.completedAt}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
