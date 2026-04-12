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
        "bg-card rounded-xl shadow-sm px-5 py-5 flex flex-col gap-3 relative overflow-hidden",
        className
      )}
    >
      {/* Icon — top right */}
      <div className={cn("absolute top-4 right-4 p-2 rounded-lg", iconBg)}>
        {icon}
      </div>

      {/* Label */}
      <p className="text-label text-muted-foreground pr-10">{label}</p>

      {/* Value */}
      <p className="text-kpi text-foreground leading-none">{value}</p>
    </div>
  )
}
