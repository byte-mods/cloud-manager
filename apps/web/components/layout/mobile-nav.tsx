"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Server, Shield, DollarSign, Bot } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Compute", href: "/dashboard/compute/instances", icon: Server },
  { label: "Security", href: "/dashboard/security/iam/users", icon: Shield },
  { label: "Cost", href: "/dashboard/cost", icon: DollarSign },
  { label: "AI", href: "/dashboard/ai/chat", icon: Bot },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href.split("/").slice(0, 3).join("/")))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
