import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "rushx-btn-splash group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl border border-transparent bg-clip-padding text-sm font-semibold tracking-[-0.01em] whitespace-nowrap transition-all duration-200 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-violet-500 via-violet-600 to-indigo-600 text-white border-violet-300/30 shadow-[0_10px_26px_-10px_rgba(124,58,237,0.68),inset_0_1px_0_rgba(255,255,255,0.28)] hover:from-violet-400 hover:via-violet-500 hover:to-indigo-600 hover:shadow-[0_14px_32px_-10px_rgba(124,58,237,0.82),inset_0_1px_0_rgba(255,255,255,0.38)]",
        outline:
          "border-violet-200/[0.14] bg-white/[0.035] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] hover:bg-violet-500/[0.1] hover:border-violet-400/[0.34] aria-expanded:bg-white/[0.08] aria-expanded:text-foreground",
        secondary:
          "bg-[linear-gradient(180deg,rgba(28,34,62,0.92)_0%,rgba(14,18,36,0.96)_100%)] text-secondary-foreground border-violet-300/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-violet-400/[0.3] hover:bg-[linear-gradient(180deg,rgba(36,44,78,0.95)_0%,rgba(18,24,46,0.98)_100%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "text-muted-foreground hover:bg-violet-500/[0.1] hover:text-foreground aria-expanded:bg-white/[0.06] aria-expanded:text-foreground",
        destructive:
          "bg-destructive/14 text-destructive border-destructive/28 hover:bg-destructive/24 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-violet-300 underline-offset-4 hover:text-violet-200 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
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
  asChild,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  // Compatibility with Radix-style `asChild`: render the child element
  // (e.g. a Link) as the button root via Base UI's `render` prop.
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ children?: React.ReactNode }>
    return (
      <ButtonPrimitive
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        render={child}
        nativeButton={false}
        {...props}
      >
        {child.props.children}
      </ButtonPrimitive>
    )
  }
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }

