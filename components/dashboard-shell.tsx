"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"

interface DashboardShellProps {
  userEmail: string | null
  children: React.ReactNode
}

export function DashboardShell({ userEmail, children }: DashboardShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        userEmail={userEmail}
        onLogout={handleLogout}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">
        <TopBar onMenuClick={() => setDrawerOpen(true)} />
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  )
}
