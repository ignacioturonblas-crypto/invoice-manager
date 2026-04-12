"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, CreditCard, Package, Briefcase, LogOut } from "lucide-react"
import { Sheet } from "@/components/ui/sheet"

interface SidebarProps {
  userEmail: string | null
  onLogout: () => void
  open: boolean
  onClose: () => void
}

const NAV_ITEMS = [
  { id: "invoices", label: "Invoices", href: "/dashboard", icon: FileText, locked: false },
  { id: "billing", label: "Billing", href: "/billing", icon: CreditCard, locked: true },
  { id: "orders", label: "Orders", href: "/orders", icon: Package, locked: true },
  { id: "projects", label: "Project Management", href: "/projects", icon: Briefcase, locked: true },
]

function SidebarBody({ userEmail, onLogout }: Pick<SidebarProps, "userEmail" | "onLogout">) {
  const pathname = usePathname()
  const isInvoicesActive =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/invoice") ||
    pathname === "/upload"

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border shrink-0">
        <span className="text-sm font-semibold text-sidebar-foreground tracking-tight">
          Invoice Manager
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = item.id === "invoices" ? isInvoicesActive : pathname === item.href

          if (item.locked) {
            return (
              <div
                key={item.id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] opacity-40 cursor-default select-none"
              >
                <Icon className="size-4 shrink-0 text-sidebar-foreground" />
                <span className="flex-1 text-sidebar-foreground truncate">{item.label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sidebar-border text-sidebar-muted-foreground font-medium">
                  Soon
                </span>
              </div>
            )
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              className={[
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors",
                isActive
                  ? "border-l-2 border-sidebar-primary bg-sidebar-accent text-sidebar-primary font-medium pl-[10px]"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              ].join(" ")}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-sidebar-border shrink-0">
        <div className="flex items-center gap-2 px-2">
          <div className="size-7 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
            <span className="text-[11px] font-semibold text-sidebar-primary">
              {userEmail?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
          <span className="text-xs text-sidebar-muted-foreground truncate flex-1">
            {userEmail ?? ""}
          </span>
          <button
            onClick={onLogout}
            className="text-sidebar-muted-foreground hover:text-sidebar-foreground transition-colors shrink-0"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function Sidebar({ userEmail, onLogout, open, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop: permanent sidebar */}
      <aside className="hidden lg:flex w-64 h-screen flex-col shrink-0 border-r border-sidebar-border">
        <SidebarBody userEmail={userEmail} onLogout={onLogout} />
      </aside>

      {/* Mobile: slide-over drawer */}
      <div className="lg:hidden">
        <Sheet open={open} onClose={onClose}>
          <SidebarBody userEmail={userEmail} onLogout={onLogout} />
        </Sheet>
      </div>
    </>
  )
}
