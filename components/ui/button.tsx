import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-[13px] font-medium whitespace-nowrap transition-all duration-150 outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /* Primary: near-black pill — Intercom CTA style */
        default:
          "bg-foreground text-background hover:bg-foreground/85 active:bg-foreground/90",
        /* Outline: warm border, fills on hover */
        outline:
          "border-border bg-card text-foreground hover:bg-muted aria-expanded:bg-muted dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        /* Secondary: subtle muted fill */
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70 aria-expanded:bg-secondary",
        /* Ghost: no fill, hover only */
        ghost:
          "hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent dark:hover:bg-muted/50",
        /* Destructive: soft red */
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/18 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30",
        link: "text-primary underline-offset-4 hover:underline rounded-none",
      },
      size: {
        default: "h-8 gap-1.5 px-3.5",
        xs:      "h-6 gap-1 px-2.5 text-[11px] [&_svg:not([class*='size-'])]:size-3",
        sm:      "h-7 gap-1.5 px-3 text-[12px] [&_svg:not([class*='size-'])]:size-3.5",
        lg:      "h-9 gap-2 px-5 text-[14px]",
        icon:    "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
