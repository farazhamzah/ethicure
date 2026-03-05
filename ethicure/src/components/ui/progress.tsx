import * as React from "react"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { value?: number }
>(({ className, value = 0, ...props }, ref) => {
  const clampedValue = Math.min(100, Math.max(0, value ?? 0))

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clampedValue)}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <div
        className="h-full bg-primary transition-all"
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  )
})

Progress.displayName = "Progress"

export { Progress }
