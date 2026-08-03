import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 transition-all outline-none",
        "placeholder:text-slate-400",
        "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
