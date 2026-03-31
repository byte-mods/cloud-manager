"use client"

import { useState, useMemo } from "react"
import {
  Shield,
  Play,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  Settings,
  ExternalLink,
  MoreHorizontal,
  Download,
  RefreshCw,
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
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { usePenTests } from "@/hooks/use-security-testing"

type AutomatedScan = {
  id: string
  tool: "OWASP ZAP" | "Nuclei"
  target: string
  status: "completed" | "running" | "scheduled" | "failed"
  findings: { high: number; medium: number; low: number; info: number }
  lastRun: string
  duration: string
  config: string
}

type ChecklistItem = {
  id: string
  category: string
  control: string
  description: string
  status: "pass" | "fail" | "na" | "untested"
  notes: string
}


const statusIcons: Record<string, React.ReactNode> = {
  pass: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  fail: <XCircle className="h-4 w-4 text-red-500" />,
  na: <MinusCircle className="h-4 w-4 text-gray-400" />,
  untested: <Clock className="h-4 w-4 text-yellow-500" />,
}

const statusLabels: Record<string, string> = {
  pass: "Pass",
  fail: "Fail",
  na: "N/A",
  untested: "Untested",
}

const scanStatusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  running: "secondary",
  scheduled: "outline",
  failed: "destructive",
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  )
}

export default function PenTestingPage() {
  const { data, isLoading, error } = usePenTests()
  const penTests = data?.tests ?? []
  const [activeTab, setActiveTab] = useState("automated")
  const [checklistFilter, setChecklistFilter] = useState<string>("all")

  const automatedScans: AutomatedScan[] = useMemo(() =>
    penTests.map((t) => ({
      id: t.id,
      tool: "OWASP ZAP" as const,
      target: t.scope,
      status: t.status === "in-progress" ? "running" as const : t.status === "completed" ? "completed" as const : "scheduled" as const,
      findings: { high: t.criticalFindings, medium: Math.max(0, t.findingsCount - t.criticalFindings), low: 0, info: 0 },
      lastRun: t.startDate,
      duration: "-",
      config: t.tester,
    })),
    [penTests]
  )

  const mockOWASPChecklist: ChecklistItem[] = []

  const filteredChecklist = mockOWASPChecklist.filter((item) =>
    checklistFilter === "all" || item.status === checklistFilter
  )

  const checklistStats = {
    pass: mockOWASPChecklist.filter((i) => i.status === "pass").length,
    fail: mockOWASPChecklist.filter((i) => i.status === "fail").length,
    na: mockOWASPChecklist.filter((i) => i.status === "na").length,
    untested: mockOWASPChecklist.filter((i) => i.status === "untested").length,
  }

  if (isLoading) return <div className="space-y-4">{Array.from({length:5}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Penetration Testing</h1>
          <p className="text-muted-foreground mt-1">Automated scanning and manual security testing checklists.</p>
        </div>
        <Card className="border-red-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-red-500">Failed to load pen tests. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Penetration Testing</h1>
        <p className="text-muted-foreground mt-1">
          Automated scanning and manual security testing checklists.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="automated" className="gap-2">
            <Settings className="h-4 w-4" /> Automated Scans
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2">
            <Shield className="h-4 w-4" /> Manual Checklists
          </TabsTrigger>
        </TabsList>

        <TabsContent value="automated" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Automated penetration testing using OWASP ZAP and Nuclei.
            </p>
            <Button>
              <Play className="mr-2 h-4 w-4" /> New Scan
            </Button>
          </div>

          {isLoading ? (
            <LoadingSkeleton />
          ) : (
            <div className="space-y-4">
              {automatedScans.map((scan) => (
                <Card key={scan.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">{scan.tool}</Badge>
                          <span className="font-medium">{scan.target}</span>
                          <Badge variant={scanStatusVariants[scan.status]}>{scan.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Config: {scan.config}</span>
                          <span>Duration: {scan.duration}</span>
                          <span>Last Run: {scan.lastRun}</span>
                        </div>
                        {scan.status === "completed" && (
                          <div className="flex items-center gap-2 mt-2">
                            {scan.findings.high > 0 && (
                              <Badge variant="destructive" className="text-xs">{scan.findings.high} High</Badge>
                            )}
                            {scan.findings.medium > 0 && (
                              <Badge variant="secondary" className="text-xs">{scan.findings.medium} Medium</Badge>
                            )}
                            {scan.findings.low > 0 && (
                              <Badge variant="outline" className="text-xs">{scan.findings.low} Low</Badge>
                            )}
                            {scan.findings.info > 0 && (
                              <Badge variant="outline" className="text-xs">{scan.findings.info} Info</Badge>
                            )}
                          </div>
                        )}
                        {scan.status === "running" && (
                          <Progress value={45} className="h-2 w-48 mt-2" />
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><RefreshCw className="mr-2 h-4 w-4" /> Re-run</DropdownMenuItem>
                          <DropdownMenuItem><Download className="mr-2 h-4 w-4" /> Export Report</DropdownMenuItem>
                          <DropdownMenuItem><Settings className="mr-2 h-4 w-4" /> Configure</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <p className="text-sm text-muted-foreground">
                OWASP Top 10 (2021) security checklist.
              </p>
              <div className="flex items-center gap-2">
                {Object.entries(checklistStats).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-1">
                    {statusIcons[status]}
                    <span className="text-xs font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <Select value={checklistFilter} onValueChange={setChecklistFilter}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pass">Pass</SelectItem>
                <SelectItem value="fail">Fail</SelectItem>
                <SelectItem value="na">N/A</SelectItem>
                <SelectItem value="untested">Untested</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-green-500/30">
              <CardContent className="pt-6 text-center">
                <div className="text-2xl font-bold text-green-500">{checklistStats.pass}</div>
                <p className="text-xs text-muted-foreground">Passed</p>
              </CardContent>
            </Card>
            <Card className="border-red-500/30">
              <CardContent className="pt-6 text-center">
                <div className="text-2xl font-bold text-red-500">{checklistStats.fail}</div>
                <p className="text-xs text-muted-foreground">Failed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-2xl font-bold text-gray-400">{checklistStats.na}</div>
                <p className="text-xs text-muted-foreground">N/A</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-2xl font-bold text-yellow-500">{checklistStats.untested}</div>
                <p className="text-xs text-muted-foreground">Untested</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md border">
                <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-4 p-3 bg-muted text-xs font-medium">
                  <span>Status</span>
                  <span>Control</span>
                  <span>Category</span>
                  <span>Notes</span>
                </div>
                {filteredChecklist.map((item) => (
                  <div key={item.id} className="grid grid-cols-[auto_1fr_auto_1fr] gap-4 p-3 border-t items-start">
                    <div className="flex items-center gap-2">
                      {statusIcons[item.status]}
                      <span className="text-xs font-medium">{statusLabels[item.status]}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.control}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    </div>
                    <Badge variant="outline" className="text-xs whitespace-nowrap">{item.category.split(" - ")[0]}</Badge>
                    <p className="text-xs text-muted-foreground">{item.notes}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
