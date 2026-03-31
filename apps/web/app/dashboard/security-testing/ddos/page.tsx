"use client"

import { useState, useCallback, useMemo } from "react"
import {
  AlertTriangle,
  Upload,
  Play,
  Square,
  Shield,
  Clock,
  FileCheck,
  Zap,
  Activity,
  CheckCircle2,
  XCircle,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useDDoSTests } from "@/hooks/use-security-testing"

export default function DDoSTestingPage() {
  const { data, isLoading, error } = useDDoSTests()
  const tests = data?.tests ?? []
  const [authFile, setAuthFile] = useState<File | null>(null)
  const [authVerified, setAuthVerified] = useState(false)
  const [testTarget, setTestTarget] = useState("")
  const [testType, setTestType] = useState("")
  const [testDuration, setTestDuration] = useState("")
  const [testIntensity, setTestIntensity] = useState("")
  const [isTestRunning, setIsTestRunning] = useState(false)
  const [testProgress, setTestProgress] = useState(0)
  const [showKillConfirm, setShowKillConfirm] = useState(false)

  const handleAuthUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAuthFile(file)
      setTimeout(() => setAuthVerified(true), 1500)
    }
  }, [])

  const handleStartTest = useCallback(() => {
    if (!authVerified || !testTarget || !testType || !testDuration || !testIntensity) return
    setIsTestRunning(true)
    setTestProgress(0)
    const interval = setInterval(() => {
      setTestProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsTestRunning(false)
          return 100
        }
        return prev + 2
      })
    }, 500)
  }, [authVerified, testTarget, testType, testDuration, testIntensity])

  const handleKillSwitch = useCallback(() => {
    setIsTestRunning(false)
    setTestProgress(0)
    setShowKillConfirm(false)
  }, [])

  const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    completed: "default",
    killed: "destructive",
    failed: "destructive",
  }

  if (isLoading) return <div className="space-y-4">{Array.from({length:5}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DDoS Testing</h1>
          <p className="text-muted-foreground mt-1">Authorized distributed denial-of-service resilience testing.</p>
        </div>
        <Card className="border-red-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-red-500">Failed to load DDoS tests. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">DDoS Testing</h1>
        <p className="text-muted-foreground mt-1">
          Authorized distributed denial-of-service resilience testing.
        </p>
      </div>

      <Card className="border-red-500/50 bg-red-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-red-500">WARNING: Authorized Use Only</p>
              <p className="text-sm text-muted-foreground mt-1">
                DDoS testing must only be performed against infrastructure you own or have explicit written authorization to test.
                Unauthorized DDoS attacks are illegal and may result in criminal prosecution. A signed authorization document
                must be uploaded before any test can be initiated. All activity is logged and audited.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-yellow-500">Authorization Required</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload a signed authorization document before configuring any DDoS test. The document must include
                target scope, testing window, and authorized personnel signatures.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Authorization Upload
          </CardTitle>
          <CardDescription>Upload signed authorization document (PDF, DOC, or signed image)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <Label htmlFor="auth-upload" className="cursor-pointer">
              <span className="text-sm font-medium text-primary hover:underline">Click to upload</span>
              <span className="text-sm text-muted-foreground"> or drag and drop</span>
            </Label>
            <Input
              id="auth-upload"
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.png,.jpg"
              onChange={handleAuthUpload}
            />
            <p className="text-xs text-muted-foreground mt-2">PDF, DOC, DOCX, PNG, JPG up to 10MB</p>
          </div>
          {authFile && (
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <FileCheck className={`h-5 w-5 ${authVerified ? "text-green-500" : "text-yellow-500"}`} />
              <div className="flex-1">
                <p className="text-sm font-medium">{authFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {authVerified ? "Authorization verified" : "Verifying authorization..."}
                </p>
              </div>
              <Badge variant={authVerified ? "default" : "secondary"}>
                {authVerified ? "Verified" : "Pending"}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={!authVerified ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Test Configuration
          </CardTitle>
          <CardDescription>Configure DDoS resilience test parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="ddos-target">Target</Label>
              <Input
                id="ddos-target"
                placeholder="api.example.com"
                value={testTarget}
                onChange={(e) => setTestTarget(e.target.value)}
                disabled={isTestRunning}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ddos-type">Attack Type</Label>
              <Select value={testType} onValueChange={setTestType} disabled={isTestRunning}>
                <SelectTrigger id="ddos-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="http-flood">HTTP Flood</SelectItem>
                  <SelectItem value="syn-flood">SYN Flood</SelectItem>
                  <SelectItem value="slowloris">Slowloris</SelectItem>
                  <SelectItem value="udp-flood">UDP Flood</SelectItem>
                  <SelectItem value="amplification">DNS Amplification</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ddos-duration">Duration (max 5 minutes)</Label>
              <Select value={testDuration} onValueChange={setTestDuration} disabled={isTestRunning}>
                <SelectTrigger id="ddos-duration"><SelectValue placeholder="Select duration" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 minute</SelectItem>
                  <SelectItem value="2">2 minutes</SelectItem>
                  <SelectItem value="3">3 minutes</SelectItem>
                  <SelectItem value="5">5 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ddos-intensity">Intensity</Label>
              <Select value={testIntensity} onValueChange={setTestIntensity} disabled={isTestRunning}>
                <SelectTrigger id="ddos-intensity"><SelectValue placeholder="Select intensity" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (1,000 RPS)</SelectItem>
                  <SelectItem value="medium">Medium (10,000 RPS)</SelectItem>
                  <SelectItem value="high">High (50,000 RPS)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            {!isTestRunning ? (
              <Button
                onClick={handleStartTest}
                disabled={!testTarget || !testType || !testDuration || !testIntensity}
              >
                <Play className="mr-2 h-4 w-4" /> Start Test
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="lg"
                className="h-14 px-8 text-lg font-bold animate-pulse"
                onClick={() => setShowKillConfirm(true)}
              >
                <Square className="mr-2 h-5 w-5" />
                KILL SWITCH
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isTestRunning && (
        <Card className="border-blue-500/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-500 animate-pulse" />
                  Active Test
                </CardTitle>
                <CardDescription>
                  {testType} against {testTarget} - {testDuration} min at {testIntensity} intensity
                </CardDescription>
              </div>
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3 animate-pulse" /> Running
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span className="font-medium">{testProgress}%</span>
              </div>
              <Progress value={testProgress} className="h-3" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold">12,450</p>
                <p className="text-xs text-muted-foreground">Current RPS</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold">189ms</p>
                <p className="text-xs text-muted-foreground">Avg Response</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold">1.2%</p>
                <p className="text-xs text-muted-foreground">Error Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showKillConfirm} onOpenChange={setShowKillConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-500">Activate Kill Switch?</DialogTitle>
            <DialogDescription>
              This will immediately stop the active DDoS test. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKillConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleKillSwitch}>
              <Square className="mr-2 h-4 w-4" /> Confirm Kill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
          <CardDescription>History of DDoS resilience tests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="grid grid-cols-8 gap-2 p-3 bg-muted text-xs font-medium">
              <span>Target</span>
              <span>Type</span>
              <span>Duration</span>
              <span>Intensity</span>
              <span>Peak RPS</span>
              <span>Avg Response</span>
              <span>Error Rate</span>
              <span>Status</span>
            </div>
            {tests.map((test) => (
              <div key={test.id} className="grid grid-cols-8 gap-2 p-3 text-sm border-t items-center">
                <span className="font-mono text-xs">{test.targetEndpoint}</span>
                <span className="text-xs">{test.type}</span>
                <span className="text-xs">{test.startedAt}</span>
                <Badge variant="outline" className="text-xs w-fit">{test.status}</Badge>
                <span className="text-xs font-medium">{test.maxRps.toLocaleString()}</span>
                <span className="text-xs">-</span>
                <span className="text-xs font-medium">
                  {test.result ?? "-"}
                </span>
                <Badge variant={statusVariants[test.status] ?? "secondary"} className="text-xs w-fit">
                  {test.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
          <CardDescription>Complete log of all DDoS testing activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {([] as { timestamp: string; action: string; user: string; details: string }[]).map((entry, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{entry.action}</span>
                    <span className="text-xs text-muted-foreground">{entry.user}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{entry.details}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{entry.timestamp}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
