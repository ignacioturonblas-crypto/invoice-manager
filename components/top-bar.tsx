"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TopBarProps {
  onMenuClick: () => void
}

const TITLES: Record<string, string> = {
  "/dashboard": "Invoices",
  "/upload": "Upload Invoice",
  "/suppliers": "Suppliers",
  "/billing": "Billing",
  "/orders": "Orders",
  "/projects": "Project Management",
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const pathname = usePathname()

  const title =
    pathname.startsWith("/invoice/")
      ? "Invoice Details"
      : (TITLES[pathname] ?? "Invoice Manager")

  return (
    <header className="h-12 border-b border-border bg-card sticky top-0 z-10 flex items-center px-4 gap-3 shrink-0">
      <button
        className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      <h1 className="text-[15px] font-semibold tracking-tight flex-1">{title}</h1>

      {pathname === "/dashboard" && (
        <Link href="/upload">
          <Button size="sm" className="gap-1.5">
            <Plus className="size-3.5" />
            Upload
          </Button>
        </Link>
      )}
    </header>
  )
}
