"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent text-sm font-semibold whitespace-nowrap transition-all duration-150 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:   "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        outline:   "border-border bg-background hover:bg-muted/60 text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:     "hover:bg-muted text-foreground",
        destructive: "bg-destructive text-white hover:bg-destructive/90 shadow-sm",
        success:   "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
        warning:   "bg-amber-500 text-white hover:bg-amber-600 shadow-sm",
        link:      "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4",
        xs:  "h-6 px-2 text-xs rounded-lg",
        sm:  "h-8 px-3 text-sm",
        lg:  "h-11 px-6 text-base",
        xl:  "h-14 px-8 text-lg",
        icon:    "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
