"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { Topbar } from "./topbar"
import { CommandPalette } from "./command-palette"
import MobileNav from "./mobile-nav"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { useAuthStore } from "@/stores/auth-store"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    if (session?.user) {
      const u = session.user as any
      setUser({
        id: u.id ?? "demo",
        email: u.email ?? "",
        name: u.name ?? "Demo User",
        role: u.role ?? "cloud_architect",
        mfaEnabled: false,
        organization: "Cloud Manager Inc.",
      })
    }
  }, [session, setUser])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Topbar />
        <div className="flex-1 overflow-auto p-4 sm:p-6 pb-20 md:pb-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </SidebarInset>
      <CommandPalette />
      <MobileNav />
    </SidebarProvider>
  )
}
