"use client"

import { useState, useMemo } from "react"
import {
  FileCode,
  Download,
  Copy,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  MinusCircle,
  ChevronRight,
  Sparkles,
  Shield,
  ExternalLink,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  useComplianceCodeStore,
  type Framework,
  type ControlStatus,
  type PolicyFormat,
} from "@/stores/compliance-code-store"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const frameworkOptions: { value: Framework; label: string }[] = [
  { value: "SOC2", label: "SOC 2" },
  { value: "ISO27001", label: "ISO 27001" },
  { value: "HIPAA", label: "HIPAA" },
  { value: "PCI-DSS", label: "PCI-DSS 4.0" },
  { value: "GDPR", label: "GDPR" },
  { value: "NIST CSF", label: "NIST CSF" },
  { value: "CIS", label: "CIS Benchmarks" },
]

const frameworkDescriptions: Record<Framework, string> = {
  SOC2: "Service Organization Control 2 - Trust Service Criteria for security, availability, and confidentiality.",
  ISO27001: "International standard for information security management systems (ISMS).",
  HIPAA: "Health Insurance Portability and Accountability Act - Safeguards for protected health information.",
  "PCI-DSS": "Payment Card Industry Data Security Standard v4.0 for cardholder data protection.",
  GDPR: "General Data Protection Regulation - EU data protection and privacy regulation.",
  "NIST CSF": "NIST Cybersecurity Framework - Standards, guidelines, and best practices.",
  CIS: "Center for Internet Security Benchmarks - Prescriptive security configuration guidelines.",
}

const statusConfig: Record<ControlStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  generated: { label: "Policy Generated", color: "text-green-600 bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800", icon: CheckCircle2 },
  manual_review: { label: "Manual Review Required", color: "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800", icon: AlertTriangle },
  not_applicable: { label: "Not Applicable", color: "text-gray-500 bg-gray-50 border-gray-200 dark:bg-gray-950/30 dark:border-gray-700", icon: MinusCircle },
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ComplianceCodePage() {
  const { data: frameworks } = useQuery({ queryKey: ['compliance-frameworks'], queryFn: () => apiClient.get('/v1/security/compliance'), enabled: false })
  const {
    selectedFramework,
    controls,
    policyTemplates,
    generatedPolicies,
    activeFormat,
    selectFramework,
    setActiveFormat,
    generatePolicy,
    exportPolicies,
  } = useComplianceCodeStore()

  const [codeDialogOpen, setCodeDialogOpen] = useState(false)
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [pushStatus, setPushStatus] = useState<"idle" | "pushing" | "done">("idle")

  const currentControls = controls[selectedFramework] || []
  const generatedCount = currentControls.filter((c) => c.status === "generated").length
  const manualCount = currentControls.filter((c) => c.status === "manual_review").length

  // Find the template for the selected control
  const selectedTemplate = useMemo(() => {
    if (!selectedControlId) return null
    return policyTemplates.find(
      (t) => t.controlId === selectedControlId && t.framework === selectedFramework,
    )
  }, [selectedControlId, selectedFramework, policyTemplates])

  // Generated policies for current framework
  const frameworkPolicies = useMemo(
    () => generatedPolicies.filter((p) => p.framework === selectedFramework),
    [generatedPolicies, selectedFramework],
  )

  const handleGenerate = (controlId: string) => {
    setSelectedControlId(controlId)
    setCodeDialogOpen(true)
  }

  const handleGenerateAndSave = () => {
    if (selectedControlId) {
      generatePolicy(selectedControlId)
    }
  }

  const handleCopyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // fallback
    }
  }

  const handleExport = () => {
    const files = exportPolicies()
    if (files.length === 0) return

    // Simulate download by creating blob for each file
    files.forEach((f) => {
      const blob = new Blob([f.content], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = f.filename
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  const handlePushToGit = () => {
    setPushStatus("pushing")
    setTimeout(() => {
      setPushStatus("done")
      setTimeout(() => setPushStatus("idle"), 2000)
    }, 1500)
  }

  const getCodeForFormat = (format: PolicyFormat): string => {
    if (!selectedTemplate) return "// No policy template available for this control"
    switch (format) {
      case "terraform": return selectedTemplate.terraform
      case "opa": return selectedTemplate.opa
      case "cloudformation": return selectedTemplate.cloudformation
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileCode className="h-6 w-6" />
            Compliance as Code
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate Terraform, OPA, and CloudFormation policies from compliance frameworks
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select
            value={selectedFramework}
            onValueChange={(v) => selectFramework(v as Framework)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {frameworkOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Framework Overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                {frameworkOptions.find((f) => f.value === selectedFramework)?.label}
              </CardTitle>
              <CardDescription className="mt-1">
                {frameworkDescriptions[selectedFramework]}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{currentControls.length}</div>
              <div className="text-xs text-muted-foreground">Total Controls</div>
            </div>
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{generatedCount}</div>
              <div className="text-xs text-green-600/80">Policy Generated</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{manualCount}</div>
              <div className="text-xs text-yellow-600/80">Manual Review</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{frameworkPolicies.length}</div>
              <div className="text-xs text-blue-600/80">Generated This Session</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controls List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Controls</CardTitle>
          <CardDescription>
            Compliance controls for {frameworkOptions.find((f) => f.value === selectedFramework)?.label}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {currentControls.map((control) => {
            const status = statusConfig[control.status]
            const StatusIcon = status.icon
            const hasTemplate = policyTemplates.some(
              (t) => t.controlId === control.controlId && t.framework === selectedFramework,
            )
            const isGenerated = generatedPolicies.some(
              (p) => p.controlId === control.controlId && p.framework === selectedFramework,
            )

            return (
              <div
                key={control.id}
                className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold font-mono">{control.controlId}</span>
                    <span className="text-sm text-muted-foreground">-</span>
                    <span className="text-sm font-medium truncate">{control.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {control.description}
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className={`shrink-0 text-[11px] gap-1 ${status.color}`}
                >
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </Badge>

                {hasTemplate && (
                  <Button
                    variant={isGenerated ? "outline" : "default"}
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={() => handleGenerate(control.controlId)}
                  >
                    {isGenerated ? (
                      <>
                        <ExternalLink className="h-3.5 w-3.5" />
                        View Policy
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        Generate Policy
                      </>
                    )}
                  </Button>
                )}

                {!hasTemplate && control.status !== "not_applicable" && (
                  <Button variant="ghost" size="sm" disabled className="shrink-0 text-xs">
                    Coming Soon
                  </Button>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Generated Policies */}
      {frameworkPolicies.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Generated Policies</CardTitle>
                <CardDescription>
                  {frameworkPolicies.length} policies generated for {selectedFramework}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
                  <Download className="h-3.5 w-3.5" />
                  Export All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handlePushToGit}
                  disabled={pushStatus === "pushing"}
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  {pushStatus === "pushing"
                    ? "Pushing..."
                    : pushStatus === "done"
                      ? "Pushed!"
                      : "Push to Git"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {frameworkPolicies.map((policy) => (
              <div key={policy.id} className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {policy.controlId}
                    </Badge>
                    <span className="text-sm font-medium">{policy.title}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {policy.format}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleCopyCode(policy.code, policy.id)}
                  >
                    {copiedId === policy.id ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <pre className="p-3 text-xs font-mono overflow-x-auto bg-gray-950 text-gray-100 dark:bg-gray-900 max-h-[200px]">
                  <code>{policy.code}</code>
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Code Generation Dialog */}
      <Dialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              {selectedTemplate ? selectedTemplate.title : "Generate Policy"}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate
                ? `${selectedControlId} - ${selectedTemplate.description}`
                : "Select a control to generate a policy"}
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <Tabs
                value={activeFormat}
                onValueChange={(v) => setActiveFormat(v as PolicyFormat)}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <TabsList className="shrink-0">
                  <TabsTrigger value="terraform">Terraform</TabsTrigger>
                  <TabsTrigger value="opa">OPA Rego</TabsTrigger>
                  <TabsTrigger value="cloudformation">CloudFormation</TabsTrigger>
                  <TabsTrigger value="sentinel">Sentinel</TabsTrigger>
                </TabsList>

                <TabsContent value="terraform" className="flex-1 overflow-hidden mt-3">
                  <div className="h-full overflow-auto rounded-lg border">
                    <pre className="p-4 text-xs font-mono bg-gray-950 text-gray-100 dark:bg-gray-900 min-h-full">
                      <code>{selectedTemplate.terraform}</code>
                    </pre>
                  </div>
                </TabsContent>

                <TabsContent value="opa" className="flex-1 overflow-hidden mt-3">
                  <div className="h-full overflow-auto rounded-lg border">
                    <pre className="p-4 text-xs font-mono bg-gray-950 text-gray-100 dark:bg-gray-900 min-h-full">
                      <code>{selectedTemplate.opa}</code>
                    </pre>
                  </div>
                </TabsContent>

                <TabsContent value="cloudformation" className="flex-1 overflow-hidden mt-3">
                  <div className="h-full overflow-auto rounded-lg border">
                    <pre className="p-4 text-xs font-mono bg-gray-950 text-gray-100 dark:bg-gray-900 min-h-full">
                      <code>{selectedTemplate.cloudformation}</code>
                    </pre>
                  </div>
                </TabsContent>

                <TabsContent value="sentinel" className="flex-1 overflow-hidden mt-3">
                  <div className="h-full overflow-auto rounded-lg border">
                    <pre className="p-4 text-xs font-mono bg-gray-950 text-gray-100 dark:bg-gray-900 min-h-full">
                      <code>{`# Sentinel Policy - ${selectedTemplate?.name ?? "Compliance"}\n# HashiCorp Terraform Cloud / Enterprise\n\nimport "tfplan/v2" as tfplan\nimport "strings"\n\n# Ensure all S3 buckets have encryption enabled\nensure_s3_encryption = rule {\n  all tfplan.resource_changes as _, rc {\n    rc.type is "aws_s3_bucket" and\n    rc.change.after.server_side_encryption_configuration is not null\n  }\n}\n\n# Ensure all EC2 instances use approved AMIs\napproved_amis = ["ami-0abcdef1234567890", "ami-0fedcba9876543210"]\n\nensure_approved_ami = rule {\n  all tfplan.resource_changes as _, rc {\n    rc.type is "aws_instance" implies\n    rc.change.after.ami in approved_amis\n  }\n}\n\n# Ensure RDS instances are encrypted\nensure_rds_encryption = rule {\n  all tfplan.resource_changes as _, rc {\n    rc.type is "aws_db_instance" implies\n    rc.change.after.storage_encrypted is true\n  }\n}\n\n# Ensure no public security group rules\nensure_no_public_ingress = rule {\n  all tfplan.resource_changes as _, rc {\n    rc.type is "aws_security_group_rule" implies\n    rc.change.after.cidr_blocks not contains "0.0.0.0/0"\n  }\n}\n\n# Main rule\nmain = rule {\n  ensure_s3_encryption and\n  ensure_approved_ami and\n  ensure_rds_encryption and\n  ensure_no_public_ingress\n}`}</code>
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex items-center justify-between mt-4 pt-3 border-t shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => handleCopyCode(getCodeForFormat(activeFormat), "dialog")}
                >
                  {copiedId === "dialog" ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy to Clipboard
                    </>
                  )}
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCodeDialogOpen(false)}
                  >
                    Close
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      handleGenerateAndSave()
                      setCodeDialogOpen(false)
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Save Policy
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
