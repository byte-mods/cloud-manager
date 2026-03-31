"use client"

import { useState } from "react"
import {
  FileText,
  Download,
  Clock,
  CheckCircle2,
  Loader2,
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useComplianceFrameworks } from "@/hooks/use-security-testing"

type ComplianceReport = {
  id: string
  framework: string
  generatedAt: string
  status: "completed" | "generating" | "failed"
  score: number
  findings: number
}

// Mock data removed — uses useComplianceFrameworks() hook

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  completed: { label: "Completed", variant: "default" },
  generating: { label: "Generating", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
}

function scoreColor(score: number): string {
  if (score >= 90) return "text-green-500"
  if (score >= 75) return "text-yellow-500"
  return "text-red-500"
}

export default function ComplianceReportsPage() {
  const { data: frameworksData } = useComplianceFrameworks()
  const [selectedFramework, setSelectedFramework] = useState("")
  const [generating, setGenerating] = useState(false)
  const reports: ComplianceReport[] = (frameworksData?.frameworks ?? []).map((f: any) => ({
    id: f.id ?? f.name, framework: f.name ?? f.framework, generatedAt: f.lastAssessed ?? "", status: "completed", score: f.score ?? 0, findings: f.failingControls ?? 0,
  }))

  function handleGenerate() {
    if (!selectedFramework) return
    setGenerating(true)
    setTimeout(() => setGenerating(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compliance Reports</h1>
        <p className="text-muted-foreground mt-1">Generate and download compliance reports for various frameworks.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Report</CardTitle>
          <CardDescription>Select a compliance framework and generate a new report.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="grid gap-2 flex-1 max-w-sm">
              <Label htmlFor="framework">Compliance Framework</Label>
              <Select value={selectedFramework} onValueChange={setSelectedFramework}>
                <SelectTrigger id="framework">
                  <SelectValue placeholder="Select framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="soc2">SOC 2 Type II</SelectItem>
                  <SelectItem value="pci-dss">PCI DSS</SelectItem>
                  <SelectItem value="hipaa">HIPAA</SelectItem>
                  <SelectItem value="iso27001">ISO 27001</SelectItem>
                  <SelectItem value="cis">CIS Benchmark</SelectItem>
                  <SelectItem value="nist">NIST 800-53</SelectItem>
                  <SelectItem value="gdpr">GDPR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={!selectedFramework || generating}>
              {generating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><FileText className="mr-2 h-4 w-4" /> Generate Report</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Recent Reports</h2>
        {reports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No reports generated</h3>
              <p className="text-muted-foreground text-sm mt-1">Select a framework above to generate your first compliance report.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {reports.map((report) => {
              const config = statusConfig[report.status]
              return (
                <Card key={report.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">{report.framework}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(report.generatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${scoreColor(report.score)}`}>{report.score}%</p>
                        <p className="text-xs text-muted-foreground">{report.findings} findings</p>
                      </div>
                      <Badge variant={config.variant}>{config.label}</Badge>
                      <Button variant="outline" size="sm" disabled={report.status !== "completed"}>
                        <Download className="mr-2 h-4 w-4" /> Download PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
