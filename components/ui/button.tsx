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
          "rushx-primary-btn text-white border-[rgba(var(--rushx-soft-rgb),0.36)]",
        outline:
          "border-[rgba(var(--rushx-soft-rgb),0.18)] bg-white/[0.035] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] hover:bg-[rgba(var(--rushx-primary-rgb),0.14)] hover:border-[rgba(var(--rushx-soft-rgb),0.4)] aria-expanded:bg-white/[0.08] aria-expanded:text-foreground",
        secondary:
          "bg-[linear-gradient(180deg,rgba(20,30,58,0.92)_0%,rgba(11,16,34,0.96)_100%)] text-secondary-foreground border-[rgba(var(--rushx-soft-rgb),0.15)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-[rgba(var(--rushx-soft-rgb),0.34)] hover:bg-[linear-gradient(180deg,rgba(26,38,72,0.95)_0%,rgba(14,22,44,0.98)_100%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "text-muted-foreground hover:bg-[rgba(var(--rushx-primary-rgb),0.12)] hover:text-foreground aria-expanded:bg-white/[0.06] aria-expanded:text-foreground",
        destructive:
          "bg-destructive/14 text-destructive border-destructive/28 hover:bg-destructive/24 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:text-accent hover:underline",
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

