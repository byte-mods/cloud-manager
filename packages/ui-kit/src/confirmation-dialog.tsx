import * as React from "react"

interface ConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  onConfirm: () => void
}

export function ConfirmationDialog({
  open, onOpenChange, title, description, confirmLabel = "Confirm", cancelLabel = "Cancel", variant = "default", onConfirm,
}: ConfirmationDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm rounded-md border hover:bg-muted">{cancelLabel}</button>
          <button
            onClick={() => { onConfirm(); onOpenChange(false) }}
            className={`px-4 py-2 text-sm rounded-md font-medium text-white ${variant === "destructive" ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
