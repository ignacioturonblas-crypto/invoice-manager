"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

interface SheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export function Sheet({ open, onClose, children }: SheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-40 bg-[var(--overlay)] duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Popup className="fixed inset-y-0 left-0 z-50 w-64 duration-200 outline-none data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left">
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
