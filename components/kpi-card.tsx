import { cn } from "@/lib/utils"

interface KpiCardProps {
  label: string
  value: string
  icon: React.ReactNode
  iconBg: string
  className?: string
}

export function KpiCard({ label, value, icon, iconBg, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow px-5 py-4 flex items-center gap-4",
        className
      )}
    >
      <div className={cn("p-2 rounded-lg shrink-0 transition-colors", iconBg)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </p>
        <p className="text-base font-bold tabular-nums truncate">{value}</p>
      </div>
    </div>
  )
}
