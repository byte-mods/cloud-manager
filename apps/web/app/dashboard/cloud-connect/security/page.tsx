"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Lock,
  Key,
  Network,
  HardDrive,
  Server,
  Zap,
  Download,
  ChevronRight,
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
import {
  useCloudConnectStore,
  type CloudProvider,
  type SecurityIssue,
  type DiscoveredService,
} from "@/stores/cloud-connect-store"
import { useSecurityScore } from "@/hooks/use-security-score"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const providerMeta: Record<CloudProvider, { label: string; color: string }> = {
  aws: { label: "AWS", color: "text-orange-600" },
  gcp: { label: "GCP", color: "text-blue-600" },
  azure: { label: "Azure", color: "text-purple-600" },
}

const severityColors: Record<string, string> = {
  critical: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-blue-500 text-white",
  info: "bg-gray-500 text-white",
}

const severityBorder: Record<string, string> = {
  critical: "border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800",
  high: "border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800",
  medium: "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800",
  low: "border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800",
  info: "border-gray-300 bg-gray-50 dark:bg-gray-950/20 dark:border-gray-800",
}

function overallGrade(score: number): { grade: string; color: string } {
  if (score >= 90) return { grade: "A", color: "text-green-500" }
  if (score >= 80) return { grade: "B", color: "text-blue-500" }
  if (score >= 70) return { grade: "C", color: "text-yellow-500" }
  if (score >= 60) return { grade: "D", color: "text-orange-500" }
  return { grade: "F", color: "text-red-500" }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SecurityPage() {
  const { accounts, services, getSecuritySummary } = useCloudConnectStore()
  const { data: score } = useSecurityScore()

  const summary = getSecuritySummary()
  const totalIssues = summary.critical + summary.high + summary.medium + summary.low + summary.info
  const avgScore = accounts.length > 0 ? Math.round(accounts.reduce((s, a) => s + a.securityScore, 0) / accounts.length) : 100
  const grade = overallGrade(avgScore)

  // All issues flattened with service info
  const allIssues = useMemo(() => {
    const items: { issue: SecurityIssue; service: DiscoveredService }[] = []
    for (const svc of services) {
      for (const issue of svc.securityIssues) {
        items.push({ issue, service: svc })
      }
    }
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
    items.sort((a, b) => order[a.issue.severity] - order[b.issue.severity])
    return items
  }, [services])

  // Issues by provider
  const issuesByProvider = useMemo(() => {
    const map: Record<CloudProvider, number> = { aws: 0, gcp: 0, azure: 0 }
    for (const { service } of allIssues) {
      map[service.provider]++
    }
    return map
  }, [allIssues])

  // Categorize issues
  const categories = useMemo(() => {
    const cats: Record<string, { icon: typeof Shield; items: typeof allIssues }> = {
      "Access Control": { icon: Lock, items: [] },
      "Network Security": { icon: Network, items: [] },
      "Encryption": { icon: Key, items: [] },
      "IAM & Permissions": { icon: Shield, items: [] },
      "Configuration": { icon: Info, items: [] },
    }
    for (const item of allIssues) {
      const title = item.issue.title.toLowerCase()
      if (title.includes("public") || title.includes("access") || title.includes("mfa")) {
        cats["Access Control"].items.push(item)
      } else if (title.includes("network") || title.includes("security group") || title.includes("port") || title.includes("endpoint")) {
        cats["Network Security"].items.push(item)
      } else if (title.includes("encrypt") || title.includes("tls") || title.includes("ssl")) {
        cats["Encryption"].items.push(item)
      } else if (title.includes("iam") || title.includes("role") || title.includes("permission")) {
        cats["IAM & Permissions"].items.push(item)
      } else {
        cats["Configuration"].items.push(item)
      }
    }
    return cats
  }, [allIssues])

  // Storage buckets audit
  const storageBuckets = useMemo(() => {
    return services.filter((s) => s.type === "storage")
  }, [services])

  // Compute/serverless vulnerability summary
  const computeServices = useMemo(() => {
    return services.filter((s) => ["compute", "serverless", "container"].includes(s.type))
  }, [services])

  function exportReport() {
    const lines = [
      "Security Report - Cloud Connect",
      `Date: ${new Date().toLocaleDateString()}`,
      `Overall Score: ${avgScore}/100 (Grade: ${grade.grade})`,
      `Total Issues: ${totalIssues}`,
      "",
      "Issues by Severity:",
      `  Critical: ${summary.critical}`,
      `  High: ${summary.high}`,
      `  Medium: ${summary.medium}`,
      `  Low: ${summary.low}`,
      `  Info: ${summary.info}`,
      "",
      "Detailed Issues:",
      ...allIssues.map(
        (item) =>
          `  [${item.issue.severity.toUpperCase()}] ${item.issue.title} - ${item.service.resourceName} (${item.service.provider})`,
      ),
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "security-report.txt"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Overview</h1>
          <p className="text-muted-foreground mt-1">
            Security posture across all connected cloud accounts.
          </p>
        </div>
        <Button variant="outline" onClick={exportReport}>
          <Download className="mr-2 h-4 w-4" /> Export Report
        </Button>
      </div>

      {/* Overall score + severity counts */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card className="md:col-span-2">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className={`text-6xl font-bold ${grade.color}`}>{grade.grade}</div>
            <div className="text-3xl font-bold mt-1">{avgScore}/100</div>
            <div className="text-sm text-muted-foreground mt-1">Overall Security Score</div>
            <Progress value={avgScore} className="h-3 mt-3 w-full max-w-[200px]" />
          </CardContent>
        </Card>
        {(["critical", "high", "medium", "low"] as const).map((sev) => {
          const colorMap = {
            critical: { text: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30" },
            high: { text: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30" },
            medium: { text: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/30" },
            low: { text: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
          }
          const c = colorMap[sev]
          return (
            <Card key={sev}>
              <CardContent className={`flex flex-col items-center justify-center py-8 ${c.bg} rounded-xl`}>
                <div className={`text-3xl font-bold ${c.text}`}>{summary[sev]}</div>
                <div className="text-sm capitalize font-medium mt-1">{sev}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Issues by provider */}
      <Card>
        <CardHeader>
          <CardTitle>Issues by Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {(["aws", "gcp", "azure"] as CloudProvider[]).map((p) => {
              const meta = providerMeta[p]
              const acc = accounts.find((a) => a.provider === p)
              const count = issuesByProvider[p]
              return (
                <div key={p} className="flex items-center gap-4 p-4 rounded-lg border">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${meta.color}`}>{count}</div>
                    <div className="text-xs text-muted-foreground">issues</div>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{meta.label}</div>
                    <div className="text-xs text-muted-foreground">{acc?.name || p}</div>
                    {acc && (
                      <div className="mt-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>Score: {acc.securityScore}</span>
                        </div>
                        <Progress value={acc.securityScore} className="h-2" />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Issues by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            {Object.entries(categories).map(([name, cat]) => {
              const Icon = cat.icon
              return (
                <div key={name} className="flex flex-col items-center p-4 rounded-lg border text-center">
                  <Icon className="h-6 w-6 text-muted-foreground mb-2" />
                  <div className="font-medium text-sm">{name}</div>
                  <div className="text-2xl font-bold mt-1">{cat.items.length}</div>
                  <div className="text-xs text-muted-foreground">issue{cat.items.length !== 1 ? "s" : ""}</div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top issues list */}
      <Card>
        <CardHeader>
          <CardTitle>All Issues</CardTitle>
          <CardDescription>{totalIssues} issues across {services.filter((s) => s.securityIssues.length > 0).length} services</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {allIssues.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold">All Clear</h3>
              <p className="text-sm text-muted-foreground">No security issues detected across your infrastructure.</p>
            </div>
          ) : (
            allIssues.map(({ issue, service }) => {
              const meta = providerMeta[service.provider]
              return (
                <div
                  key={`${service.id}-${issue.id}`}
                  className={`flex items-start gap-4 p-4 rounded-lg border ${severityBorder[issue.severity]}`}
                >
                  <div className="shrink-0">
                    <Badge className={severityColors[issue.severity]}>{issue.severity}</Badge>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="font-medium">{issue.title}</div>
                    <p className="text-sm text-muted-foreground">{issue.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className={`${meta.color} text-[10px]`}>{meta.label}</Badge>
                      <span>{service.resourceName}</span>
                      <span>({service.serviceName})</span>
                    </div>
                    <div className="text-xs">
                      <span className="font-medium">Fix: </span>
                      <span className="text-muted-foreground">{issue.remediation}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm">Quick Fix</Button>
                    <Link href={`/dashboard/cloud-connect/services/${service.id}`}>
                      <Button variant="ghost" size="sm">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Bucket Security Audit */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Security Audit
          </CardTitle>
          <CardDescription>Security status of all storage buckets and accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left">Bucket/Account</th>
                  <th className="p-3 text-left">Provider</th>
                  <th className="p-3 text-center">Public?</th>
                  <th className="p-3 text-center">Encrypted?</th>
                  <th className="p-3 text-center">Versioned?</th>
                  <th className="p-3 text-center">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {storageBuckets.map((svc) => {
                  const meta = providerMeta[svc.provider]
                  const isPublic = svc.securityIssues.some((i) => i.title.toLowerCase().includes("public"))
                  const encrypted = !!svc.config.encryption
                  const versioned = !!svc.config.versioning
                  return (
                    <tr key={svc.id} className="hover:bg-muted/30">
                      <td className="p-3">
                        <Link href={`/dashboard/cloud-connect/services/${svc.id}`} className="font-medium hover:underline">
                          {svc.resourceName}
                        </Link>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
                      </td>
                      <td className="p-3 text-center">
                        {isPublic ? (
                          <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {encrypted ? (
                          <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {versioned ? (
                          <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500 mx-auto" />
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {svc.securityIssues.length > 0 ? (
                          <Badge variant="destructive" className="text-[10px]">{svc.securityIssues.length}</Badge>
                        ) : (
                          <span className="text-green-600 text-xs">Clean</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Code Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Compute & Serverless Security
          </CardTitle>
          <CardDescription>Vulnerability counts for compute and serverless services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left">Service</th>
                  <th className="p-3 text-left">Provider</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-center">Vulnerabilities</th>
                  <th className="p-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {computeServices.map((svc) => {
                  const meta = providerMeta[svc.provider]
                  return (
                    <tr key={svc.id} className="hover:bg-muted/30">
                      <td className="p-3 font-medium">{svc.resourceName}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground capitalize">{svc.type}</td>
                      <td className="p-3 text-center">
                        {svc.securityIssues.length > 0 ? (
                          <Badge variant="destructive" className="text-[10px]">{svc.securityIssues.length}</Badge>
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                        )}
                      </td>
                      <td className="p-3">
                        <Link href={`/dashboard/cloud-connect/services/${svc.id}`}>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
