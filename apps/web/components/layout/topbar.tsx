"use client"

import { LogOut, Search, Settings, User } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { useCloudContextStore } from "@/stores/cloud-context-store"
import { useAuthStore } from "@/stores/auth-store"
import { useUIStore } from "@/stores/ui-store"
import { Breadcrumbs } from "./breadcrumbs"
import { NotificationCenter } from "./notification-center"
import type { CloudProvider } from "@/stores/cloud-context-store"

const regions: Record<CloudProvider, Array<{ value: string; label: string }>> = {
  aws: [
    { value: "us-east-1", label: "US East (N. Virginia)" },
    { value: "us-west-2", label: "US West (Oregon)" },
    { value: "eu-west-1", label: "EU (Ireland)" },
    { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
    { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
  ],
  gcp: [
    { value: "us-central1", label: "US Central (Iowa)" },
    { value: "us-east1", label: "US East (S. Carolina)" },
    { value: "europe-west1", label: "Europe West (Belgium)" },
    { value: "asia-east1", label: "Asia East (Taiwan)" },
    { value: "asia-south1", label: "Asia South (Mumbai)" },
  ],
  azure: [
    { value: "eastus", label: "East US" },
    { value: "westus2", label: "West US 2" },
    { value: "westeurope", label: "West Europe" },
    { value: "southeastasia", label: "Southeast Asia" },
    { value: "centralindia", label: "Central India" },
  ],
}

const providerConfig: Record<CloudProvider, { label: string; color: string }> = {
  aws: { label: "AWS", color: "bg-orange-500" },
  gcp: { label: "GCP", color: "bg-blue-500" },
  azure: { label: "Azure", color: "bg-sky-500" },
}

export function Topbar() {
  const { provider, region, setProvider, setRegion } = useCloudContextStore()
  const { user, logout } = useAuthStore()
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette)

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "U"

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center border-b bg-background px-4 gap-4">
      {/* Left: Sidebar trigger + Breadcrumbs */}
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-5" />
        <Breadcrumbs />
      </div>

      {/* Search trigger */}
      <Button
        variant="outline"
        className="relative h-8 w-56 justify-start gap-2 text-sm text-muted-foreground"
        onClick={toggleCommandPalette}
      >
        <Search className="h-4 w-4" />
        <span>Search...</span>
        <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </Button>

      {/* Center: Cloud provider switcher */}
      <div className="flex items-center gap-1 mx-auto">
        {(Object.keys(providerConfig) as CloudProvider[]).map((p) => (
          <Button
            key={p}
            variant={provider === p ? "default" : "outline"}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => setProvider(p)}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full mr-1.5 ${providerConfig[p].color}`}
            />
            {providerConfig[p].label}
          </Button>
        ))}
      </div>

      {/* Right: Region selector, Notifications, User menu */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Region selector */}
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="Select region" />
          </SelectTrigger>
          <SelectContent>
            {regions[provider].map((r) => (
              <SelectItem key={r.value} value={r.value} className="text-xs">
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Notification center */}
        <NotificationCenter />

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatar} alt={user?.name || "User"} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name || "User"}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email || "user@example.com"}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
