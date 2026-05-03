"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, CreditCard, Package, Briefcase, LogOut, Building2, GitMerge } from "lucide-react"
import { Sheet } from "@/components/ui/sheet"
import { MassioLogo } from "@/components/massio-logo"

interface SidebarProps {
  userEmail: string | null
  onLogout: () => void
  open: boolean
  onClose: () => void
  invoiceCount?: number
  activeOrderCount?: number
}

const NAV_ITEMS = [
  { id: "invoices", label: "Invoices", href: "/dashboard", icon: FileText, locked: false },
  { id: "suppliers", label: "Suppliers", href: "/suppliers", icon: Building2, locked: false },
  { id: "reconciliation", label: "Reconciliation", href: "/reconciliation", icon: GitMerge, locked: false },
  { id: "billing", label: "Billing", href: "/billing", icon: CreditCard, locked: false },
  { id: "orders", label: "Orders", href: "/orders", icon: Package, locked: false },
  { id: "projects", label: "Project Management", href: "/projects", icon: Briefcase, locked: true },
]

function SidebarBody({
  userEmail,
  onLogout,
  invoiceCount,
  activeOrderCount,
}: Pick<SidebarProps, "userEmail" | "onLogout" | "invoiceCount" | "activeOrderCount">) {
  const pathname = usePathname()
  const isInvoicesActive =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/invoice") ||
    pathname === "/upload"
  const isSuppliersActive = pathname.startsWith("/suppliers")
  const isReconciliationActive = pathname.startsWith("/reconciliation")
  const isBillingActive = pathname.startsWith("/billing")
  const isOrdersActive = pathname.startsWith("/orders")

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Logo */}
      <div className="h-12 flex items-center px-4 border-b border-sidebar-border shrink-0">
        <MassioLogo width={72} className="text-sidebar-foreground" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-px overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = item.id === "invoices" ? isInvoicesActive : item.id === "suppliers" ? isSuppliersActive : item.id === "reconciliation" ? isReconciliationActive : item.id === "billing" ? isBillingActive : item.id === "orders" ? isOrdersActive : pathname === item.href

          if (item.locked) {
            return (
              <div
                key={item.id}
                className="flex items-center gap-2.5 px-3 h-9 rounded-md text-[13px] opacity-35 cursor-default select-none"
              >
                <Icon className="size-3.5 shrink-0 text-sidebar-foreground" />
                <span className="flex-1 text-sidebar-foreground truncate">{item.label}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sidebar-border/60 text-sidebar-muted-foreground font-medium tracking-wide uppercase">
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
                "relative flex items-center gap-2.5 px-3 h-9 rounded-md text-[13px] transition-colors duration-150",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              ].join(" ")}
            >
              {/* Active indicator — 3px left pill */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-sidebar-primary" />
              )}
              <Icon className="size-3.5 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {/* Badge: invoice count on Invoices, active order count on Orders */}
              {isActive && item.id === "invoices" && invoiceCount !== undefined && invoiceCount > 0 && (
                <span className="text-[10px] font-semibold tabular-nums px-1.5 min-w-[20px] text-center py-0.5 rounded-full bg-sidebar-primary/15 text-sidebar-primary">
                  {invoiceCount > 99 ? "99+" : invoiceCount}
                </span>
              )}
              {isActive && item.id === "orders" && activeOrderCount !== undefined && activeOrderCount > 0 && (
                <span className="text-[10px] font-semibold tabular-nums px-1.5 min-w-[20px] text-center py-0.5 rounded-full bg-sidebar-primary/15 text-sidebar-primary">
                  {activeOrderCount > 99 ? "99+" : activeOrderCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-3 shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-sidebar-accent/60 transition-colors group">
          <div className="size-6 rounded-full bg-sidebar-primary/20 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-sidebar-primary">
              {userEmail?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
          <span className="text-[12px] text-sidebar-muted-foreground truncate flex-1 leading-none">
            {userEmail ?? ""}
          </span>
          <button
            onClick={onLogout}
            className="text-sidebar-muted-foreground/50 hover:text-sidebar-foreground transition-colors shrink-0 opacity-0 group-hover:opacity-100"
            aria-label="Sign out"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function Sidebar({ userEmail, onLogout, open, onClose, invoiceCount, activeOrderCount }: SidebarProps) {
  return (
    <>
      {/* Desktop: permanent sidebar */}
      <aside className="hidden lg:flex w-60 h-screen flex-col shrink-0 border-r border-sidebar-border">
        <SidebarBody userEmail={userEmail} onLogout={onLogout} invoiceCount={invoiceCount} activeOrderCount={activeOrderCount} />
      </aside>

      {/* Mobile: slide-over drawer */}
      <div className="lg:hidden">
        <Sheet open={open} onClose={onClose}>
          <SidebarBody userEmail={userEmail} onLogout={onLogout} invoiceCount={invoiceCount} activeOrderCount={activeOrderCount} />
        </Sheet>
      </div>
    </>
  )
}
