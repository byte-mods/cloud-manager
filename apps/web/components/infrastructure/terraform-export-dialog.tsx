"use client"

import { useCallback, useMemo, useState } from "react"
import type { Node, Edge } from "@xyflow/react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Download,
  Copy,
  Check,
  FileCode2,
  Files,
  Terminal,
  CheckCircle2,
  ClipboardList,
  Rocket,
  Loader2,
  AlertTriangle,
  XCircle,
} from "lucide-react"
import {
  generateTerraform,
  downloadTerraformFile,
  downloadTerraformZip,
  downloadIndividualFiles,
  type TerraformFiles,
} from "@/lib/terraform-generator"
import {
  generateCloudFormation,
  downloadCloudFormationFile,
} from "@/lib/cloudformation-generator"
import {
  generateBicep,
  downloadBicepFile,
} from "@/lib/bicep-generator"
import type { CloudProvider } from "@/stores/infrastructure-store"

// ---------------------------------------------------------------------------
// Syntax-highlighted HCL preview (lightweight, no Monaco dependency)
// ---------------------------------------------------------------------------

function HclCodeBlock({ code }: { code: string }) {
  const highlighted = useMemo(() => highlightHcl(code), [code])

  return (
    <div className="relative group">
      <pre className="overflow-auto rounded-lg border bg-muted/50 p-4 text-xs leading-relaxed font-mono max-h-[420px]">
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  )
}

/** Very lightweight HCL syntax highlighter */
function highlightHcl(code: string): string {
  return code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Comments
    .replace(/(#[^\n]*)/g, '<span class="text-muted-foreground italic">$1</span>')
    // Strings
    .replace(/("(?:[^"\\]|\\.)*")/g, '<span class="text-green-400">$1</span>')
    // Keywords
    .replace(
      /\b(resource|variable|output|provider|terraform|data|module|locals)\b/g,
      '<span class="text-violet-400 font-semibold">$1</span>',
    )
    // Booleans / null
    .replace(/\b(true|false|null)\b/g, '<span class="text-orange-400">$1</span>')
    // Numbers (standalone)
    .replace(/(?<!["\w])(\d+)(?!["\w])/g, '<span class="text-sky-400">$1</span>')
    // Block type names after resource/data
    .replace(
      /(<span class="text-violet-400 font-semibold">(?:resource|data)<\/span>) (<span class="text-green-400">"[^"]*"<\/span>) (<span class="text-green-400">"[^"]*"<\/span>)/g,
      '$1 <span class="text-cyan-400 font-semibold">$2</span> $3',
    )
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  nodes: Node[]
  edges: Edge[]
  provider: CloudProvider
  projectName: string
  /** If true, shows the "deploy" messaging rather than plain export */
  deployMode?: boolean
}

export default function TerraformExportDialog({
  open,
  onOpenChange,
  nodes,
  edges,
  provider,
  projectName,
  deployMode = false,
}: Props) {
  const [exportFormat, setExportFormat] = useState<"terraform" | "cloudformation" | "bicep">("terraform")
  const [activeTab, setActiveTab] = useState<keyof TerraformFiles>("main.tf")
  const [copied, setCopied] = useState<string | null>(null)

  // Terraform operation state
  const [tfLoading, setTfLoading] = useState<"validate" | "plan" | "apply" | null>(null)
  const [tfResult, setTfResult] = useState<{
    operation: string
    success: boolean
    stdout: string
    stderr: string
    error?: string
  } | null>(null)
  const [showApplyConfirm, setShowApplyConfirm] = useState(false)

  const files = useMemo(
    () => generateTerraform(nodes, edges, provider, projectName),
    [nodes, edges, provider, projectName],
  )

  const cfnTemplate = useMemo(
    () => generateCloudFormation(nodes, edges, provider, projectName),
    [nodes, edges, provider, projectName],
  )

  const bicepFiles = useMemo(
    () => generateBicep(nodes, edges, provider, projectName),
    [nodes, edges, provider, projectName],
  )

  const totalLines = useMemo(
    () =>
      Object.values(files).reduce(
        (acc, content) => acc + content.split("\n").length,
        0,
      ),
    [files],
  )

  const resourceCount = useMemo(() => {
    const mainContent = files["main.tf"]
    return (mainContent.match(/^resource\s/gm) ?? []).length
  }, [files])

  // Copy to clipboard
  const handleCopy = useCallback(
    (file: keyof TerraformFiles) => {
      navigator.clipboard.writeText(files[file]).then(() => {
        setCopied(file)
        setTimeout(() => setCopied(null), 2000)
      })
    },
    [files],
  )

  // Download single file
  const handleDownloadFile = useCallback(
    (file: keyof TerraformFiles) => {
      downloadTerraformFile(files[file], file)
    },
    [files],
  )

  // Download combined
  const handleDownloadCombined = useCallback(() => {
    downloadTerraformZip(files, projectName)
  }, [files, projectName])

  // Download individual files
  const handleDownloadAll = useCallback(() => {
    downloadIndividualFiles(files, projectName)
  }, [files, projectName])

  // Combine all files into a single HCL string for terraform operations
  const combinedHcl = useMemo(
    () => Object.values(files).join("\n\n"),
    [files],
  )

  const CLOUD_SERVICE_URL =
    process.env.NEXT_PUBLIC_CLOUD_SERVICE_URL ?? "http://localhost:8081"

  const runTerraformOp = useCallback(
    async (operation: "validate" | "plan" | "apply", confirmed = false) => {
      setTfLoading(operation)
      setTfResult(null)

      try {
        const endpoint = `${CLOUD_SERVICE_URL}/api/v1/cloud/terraform/${operation}`
        const body: Record<string, unknown> = { hcl: combinedHcl }
        if (operation === "apply") {
          body.confirmed = confirmed
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        const data = await res.json()
        setTfResult({
          operation,
          success: data.success ?? false,
          stdout: data.stdout ?? "",
          stderr: data.stderr ?? "",
          error: data.error,
        })
      } catch (err) {
        setTfResult({
          operation,
          success: false,
          stdout: "",
          stderr: "",
          error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
        })
      } finally {
        setTfLoading(null)
      }
    },
    [combinedHcl, CLOUD_SERVICE_URL],
  )

  const handleValidate = useCallback(() => runTerraformOp("validate"), [runTerraformOp])
  const handlePlan = useCallback(() => runTerraformOp("plan"), [runTerraformOp])
  const handleApply = useCallback(() => setShowApplyConfirm(true), [])
  const handleApplyConfirmed = useCallback(() => {
    setShowApplyConfirm(false)
    runTerraformOp("apply", true)
  }, [runTerraformOp])

  const fileKeys = Object.keys(files) as (keyof TerraformFiles)[]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-violet-400" />
            {deployMode ? "Deploy Infrastructure" : "Export Terraform"}
          </DialogTitle>
          <DialogDescription>
            {deployMode ? (
              <>
                Export your infrastructure as Terraform configuration files, then
                run{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  terraform apply
                </code>{" "}
                to deploy.
              </>
            ) : (
              <>
                Generated Terraform HCL for{" "}
                <strong>{projectName}</strong> with{" "}
                <strong>{nodes.length}</strong> resources and{" "}
                <strong>{edges.length}</strong> connections.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Format selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Format:</span>
          <div className="flex rounded-lg border p-0.5 gap-0.5">
            {(["terraform", "cloudformation", "bicep"] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setExportFormat(fmt)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  exportFormat === fmt
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {fmt === "terraform" ? "Terraform" : fmt === "cloudformation" ? "CloudFormation" : "Bicep"}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-3 text-xs">
          <Badge variant="secondary" className="gap-1">
            <FileCode2 className="h-3 w-3" />
            {fileKeys.length} files
          </Badge>
          <Badge variant="secondary" className="gap-1">
            {resourceCount} resources
          </Badge>
          <Badge variant="secondary" className="gap-1">
            {totalLines} lines
          </Badge>
          <Badge
            variant="outline"
            className="gap-1 capitalize border-violet-500/30 text-violet-400"
          >
            {provider}
          </Badge>
        </div>

        {/* Deploy instructions */}
        {deployMode && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-2">
            <p className="font-semibold text-amber-400 flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5" />
              Deployment Steps
            </p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Download the Terraform files below</li>
              <li>
                Place them in a directory and run{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">
                  terraform init
                </code>
              </li>
              <li>
                Review the plan with{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">
                  terraform plan
                </code>
              </li>
              <li>
                Apply with{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">
                  terraform apply
                </code>
              </li>
            </ol>
          </div>
        )}

        {/* CloudFormation preview */}
        {exportFormat === "cloudformation" && (
          <div className="flex-1 min-h-0 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="gap-1 text-xs">
                <FileCode2 className="h-3 w-3" />
                template.yaml
              </Badge>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { navigator.clipboard.writeText(cfnTemplate); setCopied("cfn"); setTimeout(() => setCopied(null), 2000) }}>
                  {copied === "cfn" ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  {copied === "cfn" ? "Copied" : "Copy"}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => downloadCloudFormationFile(cfnTemplate, projectName)}>
                  <Download className="h-3 w-3" />Download
                </Button>
              </div>
            </div>
            <HclCodeBlock code={cfnTemplate} />
          </div>
        )}

        {/* Bicep preview */}
        {exportFormat === "bicep" && (
          <div className="flex-1 min-h-0 flex flex-col gap-2">
            {Object.entries(bicepFiles).map(([fileName, content]) => (
              <div key={fileName}>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <FileCode2 className="h-3 w-3" />
                    {fileName}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { navigator.clipboard.writeText(content); setCopied(fileName); setTimeout(() => setCopied(null), 2000) }}>
                      {copied === fileName ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                      {copied === fileName ? "Copied" : "Copy"}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => downloadBicepFile(content, projectName)}>
                      <Download className="h-3 w-3" />Download
                    </Button>
                  </div>
                </div>
                <HclCodeBlock code={content} />
              </div>
            ))}
          </div>
        )}

        {/* Terraform: File tabs + code preview */}
        {exportFormat === "terraform" && <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as keyof TerraformFiles)}
          className="flex-1 min-h-0 flex flex-col"
        >
          <div className="flex items-center justify-between">
            <TabsList>
              {fileKeys.map((file) => (
                <TabsTrigger key={file} value={file} className="text-xs gap-1">
                  <FileCode2 className="h-3 w-3" />
                  {file}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => handleCopy(activeTab)}
              >
                {copied === activeTab ? (
                  <Check className="h-3 w-3 text-green-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied === activeTab ? "Copied" : "Copy"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => handleDownloadFile(activeTab)}
              >
                <Download className="h-3 w-3" />
                Download
              </Button>
            </div>
          </div>

          {fileKeys.map((file) => (
            <TabsContent key={file} value={file} className="flex-1 min-h-0 mt-2">
              <HclCodeBlock code={files[file]} />
            </TabsContent>
          ))}
        </Tabs>}

        {/* Terraform Operations */}
        {exportFormat === "terraform" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={tfLoading !== null}
              onClick={handleValidate}
            >
              {tfLoading === "validate" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Validate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={tfLoading !== null}
              onClick={handlePlan}
            >
              {tfLoading === "plan" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ClipboardList className="h-3.5 w-3.5" />
              )}
              Plan
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              disabled={tfLoading !== null}
              onClick={handleApply}
            >
              {tfLoading === "apply" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Rocket className="h-3.5 w-3.5" />
              )}
              Apply
            </Button>
          </div>

          {/* Apply confirmation dialog */}
          {showApplyConfirm && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs space-y-2">
              <p className="font-semibold text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Are you sure?
              </p>
              <p className="text-muted-foreground">
                This will run <code className="rounded bg-muted px-1 py-0.5 font-mono">terraform apply</code> and
                create real cloud resources. This action <strong>may incur costs</strong> and cannot be easily undone.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={handleApplyConfirmed}
                >
                  <Rocket className="h-3 w-3" />
                  Yes, Apply Now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowApplyConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Terraform operation result */}
          {tfResult && (
            <div
              className={`rounded-lg border p-3 text-xs space-y-2 ${
                tfResult.success
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <p
                className={`font-semibold flex items-center gap-1.5 ${
                  tfResult.success ? "text-green-400" : "text-red-400"
                }`}
              >
                {tfResult.success ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                terraform {tfResult.operation} {tfResult.success ? "succeeded" : "failed"}
              </p>
              {tfResult.error && (
                <p className="text-red-400">{tfResult.error}</p>
              )}
              {tfResult.stdout && (
                <pre className="overflow-auto rounded border bg-muted/50 p-2 max-h-[200px] text-[11px] leading-relaxed font-mono whitespace-pre-wrap">
                  {tfResult.stdout}
                </pre>
              )}
              {tfResult.stderr && (
                <pre className="overflow-auto rounded border border-red-500/20 bg-red-500/5 p-2 max-h-[150px] text-[11px] leading-relaxed font-mono whitespace-pre-wrap text-red-300">
                  {tfResult.stderr}
                </pre>
              )}
            </div>
          )}
        </div>
        )}

        {/* Footer */}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleDownloadAll}
          >
            <Files className="h-3.5 w-3.5" />
            Download All Files
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleDownloadCombined}
          >
            <Download className="h-3.5 w-3.5" />
            Download Combined .tf
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
