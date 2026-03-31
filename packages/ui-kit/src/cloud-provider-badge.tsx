import * as React from "react"

type Provider = "aws" | "gcp" | "azure"

const providerConfig: Record<Provider, { label: string; color: string; bg: string }> = {
  aws: { label: "AWS", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950" },
  gcp: { label: "GCP", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950" },
  azure: { label: "Azure", color: "text-sky-600", bg: "bg-sky-50 dark:bg-sky-950" },
}

export function CloudProviderBadge({ provider }: { provider: Provider }) {
  const config = providerConfig[provider] ?? providerConfig.aws
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${config.color} ${config.bg}`}>
      {config.label}
    </span>
  )
}
