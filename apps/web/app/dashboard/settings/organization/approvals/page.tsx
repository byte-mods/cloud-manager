"use client"

import { useState } from "react"
import {
  CheckSquare,
  Plus,
  Shield,
  DollarSign,
  Upload,
  Lock,
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
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useApprovalStore,
  type TriggerType,
  type ApproverRole,
} from "@/stores/approval-store"
import { useApprovalRequests } from "@/hooks/use-approvals"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const triggerIcons: Record<TriggerType, typeof Upload> = {
  deploy: Upload,
  infra_change: Shield,
  security_change: Lock,
  cost_threshold: DollarSign,
}

const triggerLabels: Record<TriggerType, string> = {
  deploy: "Deployment",
  infra_change: "Infrastructure Change",
  security_change: "Security Change",
  cost_threshold: "Cost Threshold",
}

const roleLabels: Record<ApproverRole, string> = {
  cloud_architect: "Cloud Architect",
  devops_engineer: "DevOps Engineer",
  system_admin: "System Admin",
  security_engineer: "Security Engineer",
}

const allRoles: ApproverRole[] = [
  "cloud_architect",
  "devops_engineer",
  "system_admin",
  "security_engineer",
]

// ---------------------------------------------------------------------------
// Create Workflow Dialog
// ---------------------------------------------------------------------------

function CreateWorkflowDialog() {
  const { createWorkflow } = useApprovalStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [triggerType, setTriggerType] = useState<TriggerType>("deploy")
  const [conditions, setConditions] = useState("{}")
  const [requiredApprovers, setRequiredApprovers] = useState("1")
  const [selectedRoles, setSelectedRoles] = useState<ApproverRole[]>([])
  const [autoApprove, setAutoApprove] = useState("")

  function handleToggleRole(role: ApproverRole) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )
  }

  function handleSubmit() {
    if (!name.trim()) return
    let parsedConditions: Record<string, unknown> = {}
    try {
      parsedConditions = JSON.parse(conditions)
    } catch {
      // keep empty
    }
    createWorkflow({
      name,
      triggerType,
      triggerDescription: `${triggerLabels[triggerType]} trigger`,
      conditions: parsedConditions,
      requiredApprovers: parseInt(requiredApprovers, 10) || 1,
      approverRoles: selectedRoles.length > 0 ? selectedRoles : ["cloud_architect"],
      autoApproveConditions: autoApprove.trim() || null,
      enabled: true,
    })
    setOpen(false)
    setName("")
    setTriggerType("deploy")
    setConditions("{}")
    setRequiredApprovers("1")
    setSelectedRoles([])
    setAutoApprove("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Workflow
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Approval Workflow</DialogTitle>
          <DialogDescription>
            Configure a new workflow that requires approvals before changes are applied.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="wf-name">Workflow Name</Label>
            <Input
              id="wf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production Deployment"
            />
          </div>
          <div className="grid gap-2">
            <Label>Trigger Type</Label>
            <Select
              value={triggerType}
              onValueChange={(v) => setTriggerType(v as TriggerType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deploy">Deployment</SelectItem>
                <SelectItem value="infra_change">Infrastructure Change</SelectItem>
                <SelectItem value="security_change">Security Change</SelectItem>
                <SelectItem value="cost_threshold">Cost Threshold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wf-conditions">Conditions (JSON)</Label>
            <Textarea
              id="wf-conditions"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              placeholder='{"environment": "production"}'
              className="font-mono text-sm"
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wf-approvers">Required Approvers</Label>
            <Input
              id="wf-approvers"
              type="number"
              min={1}
              max={5}
              value={requiredApprovers}
              onChange={(e) => setRequiredApprovers(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Approver Roles</Label>
            <div className="flex flex-wrap gap-2">
              {allRoles.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleToggleRole(role)}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    selectedRoles.includes(role)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {roleLabels[role]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wf-auto">Auto-Approve Conditions</Label>
            <Input
              id="wf-auto"
              value={autoApprove}
              onChange={(e) => setAutoApprove(e.target.value)}
              placeholder="e.g., Dev environment changes < $50/mo"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            Create Workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApprovalsSettingsPage() {
  const { workflows, updateWorkflow } = useApprovalStore()
  const { data: approvals } = useApprovalRequests()

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <CheckSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Approval Workflows</h1>
            <p className="text-sm text-muted-foreground">
              Configure workflows that require approvals before changes are applied
            </p>
          </div>
        </div>
        <CreateWorkflowDialog />
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Workflows</CardDescription>
            <CardTitle className="text-3xl">{workflows.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl text-green-500">
              {workflows.filter((w) => w.enabled).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Disabled</CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">
              {workflows.filter((w) => !w.enabled).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Trigger Types</CardDescription>
            <CardTitle className="text-3xl">
              {new Set(workflows.map((w) => w.triggerType)).size}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Workflows table */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Workflows</CardTitle>
          <CardDescription>
            Manage your approval workflows and their settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Required Approvers</TableHead>
                <TableHead>Auto-Approve</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Enabled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((workflow) => {
                const Icon = triggerIcons[workflow.triggerType]
                return (
                  <TableRow key={workflow.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{workflow.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {workflow.triggerDescription}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {triggerLabels[workflow.triggerType]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">
                          {workflow.requiredApprovers}
                        </span>{" "}
                        <span className="text-muted-foreground">from</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {workflow.approverRoles.map((role) => (
                            <Badge
                              key={role}
                              variant="secondary"
                              className="text-xs"
                            >
                              {roleLabels[role]}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {workflow.autoApproveConditions ? (
                        <span className="text-sm">
                          {workflow.autoApproveConditions}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          None
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={workflow.enabled ? "default" : "secondary"}
                        className={
                          workflow.enabled
                            ? "bg-green-500/10 text-green-500"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {workflow.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={workflow.enabled}
                        onCheckedChange={(checked) =>
                          updateWorkflow(workflow.id, { enabled: checked })
                        }
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
