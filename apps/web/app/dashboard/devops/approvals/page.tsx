"use client"

import { useState } from "react"
import { useApprovalRequests } from "@/hooks/use-approvals"
import {
  CheckSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  ChevronDown,
  ChevronRight,
  AlertCircle,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useApprovalStore,
  type ApprovalRequest,
  type ApprovalStatus,
} from "@/stores/approval-store"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusConfig: Record<
  ApprovalStatus,
  { label: string; className: string; icon: typeof Clock }
> = {
  pending: {
    label: "Pending",
    className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    className: "bg-green-500/10 text-green-500 border-green-500/20",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-500/10 text-red-500 border-red-500/20",
    icon: XCircle,
  },
  expired: {
    label: "Expired",
    className: "bg-muted text-muted-foreground border-border",
    icon: AlertCircle,
  },
}

function timeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  return `${diffDays}d ago`
}

// ---------------------------------------------------------------------------
// Approval Card
// ---------------------------------------------------------------------------

function ApprovalCard({
  request,
  onApprove,
  onReject,
}: {
  request: ApprovalRequest
  onApprove: (id: string) => void
  onReject: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const config = statusConfig[request.status]
  const StatusIcon = config.icon

  return (
    <Card className="transition-all hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {request.requestedBy.avatar}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold leading-tight">{request.title}</h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span>by {request.requestedBy.name}</span>
                <span className="text-border">|</span>
                <span>{request.workflowName}</span>
                <span className="text-border">|</span>
                <span>{timeAgo(request.submittedAt)}</span>
              </div>
              {request.reason && (
                <p className="mt-2 text-sm text-muted-foreground italic">
                  {request.resolvedBy && (
                    <span className="font-medium not-italic">
                      {request.status === "approved" ? "Approved" : "Rejected"} by{" "}
                      {request.resolvedBy}:{" "}
                    </span>
                  )}
                  &quot;{request.reason}&quot;
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className={config.className}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {config.label}
            </Badge>
          </div>
        </div>

        {/* Expandable details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Details
        </button>

        {expanded && (
          <div className="mt-3 rounded-lg bg-muted/50 p-4">
            <pre className="whitespace-pre-wrap text-sm font-mono text-muted-foreground">
              {JSON.stringify(request.details, null, 2)}
            </pre>
          </div>
        )}

        {/* Action buttons for pending requests */}
        {request.status === "pending" && (
          <div className="mt-4 flex items-center gap-2 border-t pt-4">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => onApprove(request.id)}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onReject(request.id)}
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DevOpsApprovalsPage() {
  const { data: approvals } = useApprovalRequests()
  const { requests, approveRequest, rejectRequest } = useApprovalStore()
  const [filter, setFilter] = useState<string>("all")
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false)
  const [actionType, setActionType] = useState<"approve" | "reject">("approve")
  const [selectedRequestId, setSelectedRequestId] = useState<string>("")
  const [reason, setReason] = useState("")

  const filteredRequests = requests.filter((r) => {
    if (filter === "all") return true
    if (filter === "my") return r.status === "pending"
    return r.status === filter
  })

  const pendingCount = requests.filter((r) => r.status === "pending").length
  const approvedCount = requests.filter((r) => r.status === "approved").length
  const rejectedCount = requests.filter((r) => r.status === "rejected").length

  function handleAction(id: string, type: "approve" | "reject") {
    setSelectedRequestId(id)
    setActionType(type)
    setReason("")
    setReasonDialogOpen(true)
  }

  function handleConfirmAction() {
    if (actionType === "approve") {
      approveRequest(selectedRequestId, reason || "Approved")
    } else {
      rejectRequest(selectedRequestId, reason || "Rejected")
    }
    setReasonDialogOpen(false)
    setReason("")
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <CheckSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pending Approvals</h1>
            <p className="text-sm text-muted-foreground">
              Review and action approval requests
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Requests</SelectItem>
              <SelectItem value="my">My Approvals</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Requests</CardDescription>
            <CardTitle className="text-3xl">{requests.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-3xl text-yellow-500">{pendingCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved</CardDescription>
            <CardTitle className="text-3xl text-green-500">{approvedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rejected</CardDescription>
            <CardTitle className="text-3xl text-red-500">{rejectedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Approval cards */}
      <div className="flex flex-col gap-4">
        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckSquare className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-lg font-medium text-muted-foreground">
                No approval requests found
              </p>
              <p className="text-sm text-muted-foreground">
                Requests matching your filter will appear here
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((request) => (
            <ApprovalCard
              key={request.id}
              request={request}
              onApprove={(id) => handleAction(id, "approve")}
              onReject={(id) => handleAction(id, "reject")}
            />
          ))
        )}
      </div>

      {/* Reason Dialog */}
      <Dialog open={reasonDialogOpen} onOpenChange={setReasonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve Request" : "Reject Request"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? "Optionally provide a reason for approval."
                : "Please provide a reason for rejecting this request."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  actionType === "approve"
                    ? "LGTM - changes look good"
                    : "Please provide a reason..."
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAction}
              className={
                actionType === "approve"
                  ? "bg-green-600 hover:bg-green-700"
                  : ""
              }
              variant={actionType === "reject" ? "destructive" : "default"}
            >
              {actionType === "approve" ? "Confirm Approval" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
