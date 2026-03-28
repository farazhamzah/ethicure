import * as React from "react"
import { Bug, Loader2, Play } from "lucide-react"
import { useLocation } from "react-router-dom"

import { Button, buttonVariants } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type SweepResult = {
  label: string
  passed: boolean
  detail: string
}

const MAX_SWEEP_CLICKS = 30

export function DebugMenu() {
  const location = useLocation()
  const [isSweepRunning, setIsSweepRunning] = React.useState(false)
  const [sweepResults, setSweepResults] = React.useState<SweepResult[]>([])
  const [sweepRanAt, setSweepRanAt] = React.useState<Date | null>(null)

  const isDebugMode = React.useMemo(() => {
    const raw = new URLSearchParams(location.search).get("debug")
    if (!raw) return false
    return ["1", "true", "yes", "on"].includes(raw.toLowerCase())
  }, [location.search])

  if (!isDebugMode) return null

  const runClickSweep = async () => {
    setIsSweepRunning(true)

    const results: SweepResult[] = []
    const addResult = (label: string, passed: boolean, detail: string) => {
      results.push({ label, passed, detail })
    }

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms)
      })

    const target = document.querySelector("main")
    if (!target) {
      addResult("Debug scope", false, "Could not find a main content area.")
      setSweepResults(results)
      setSweepRanAt(new Date())
      setIsSweepRunning(false)
      return
    }

    const selector = [
      "button",
      "a[href]",
      "input[type='checkbox']",
      "input[type='radio']",
      "[role='button']",
      "[data-slot='checkbox']",
      "[data-slot='popover-trigger']",
    ].join(",")

    const seen = new Set<HTMLElement>()
    const interactive = Array.from(
      target.querySelectorAll<HTMLElement>(selector)
    ).filter((element) => {
      if (seen.has(element)) return false
      seen.add(element)

      const isVisible = element.getClientRects().length > 0
      if (!isVisible) return false

      const isDisabled =
        element.matches(":disabled") ||
        element.getAttribute("aria-disabled") === "true"
      if (isDisabled) return false

      // Skip layout chrome controls that are not page interactions.
      if (
        element.getAttribute("data-sidebar") === "trigger" ||
        element.getAttribute("data-slot") === "sidebar-trigger"
      ) {
        return false
      }

      const text =
        element.getAttribute("aria-label") ||
        element.textContent ||
        element.getAttribute("title") ||
        element.getAttribute("name") ||
        ""
      const lower = text.toLowerCase()
      // Skip potentially destructive controls in broad click sweeps.
      if (
        lower.includes("delete") ||
        lower.includes("remove") ||
        lower.includes("logout") ||
        lower.includes("deactivate")
      ) {
        return false
      }

      return true
    })

    if (!interactive.length) {
      addResult("Clickable controls", false, "No safe interactive controls found.")
      setSweepResults(results)
      setSweepRanAt(new Date())
      setIsSweepRunning(false)
      return
    }

    const limited = interactive.slice(0, MAX_SWEEP_CLICKS)
    addResult(
      "Discovery",
      true,
      `Found ${interactive.length} controls, testing ${limited.length}.`
    )

    const asyncErrors: string[] = []
    const onError = (event: ErrorEvent) => {
      asyncErrors.push(event.message || "Unknown runtime error")
    }
    const onUnhandled = (event: PromiseRejectionEvent) => {
      asyncErrors.push(String(event.reason || "Unhandled promise rejection"))
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onUnhandled)

    try {
      for (const element of limited) {
        const label =
          element.getAttribute("aria-label") ||
          element.getAttribute("title") ||
          element.textContent?.trim() ||
          element.tagName.toLowerCase()

        const previousErrors = asyncErrors.length
        const preventDefault = (event: Event) => {
          event.preventDefault()
        }

        try {
          element.addEventListener("click", preventDefault, { capture: true })
          element.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
            })
          )
          await wait(16)

          if (asyncErrors.length > previousErrors) {
            addResult(
              label,
              false,
              `Runtime error: ${asyncErrors[asyncErrors.length - 1]}`
            )
          } else {
            addResult(label, true, "Click dispatched without runtime errors.")
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          addResult(label, false, message)
        } finally {
          element.removeEventListener("click", preventDefault, {
            capture: true,
          })
        }
      }
    } finally {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onUnhandled)
      setSweepResults(results)
      setSweepRanAt(new Date())
      setIsSweepRunning(false)
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Open debug tools"
        data-testid="global-debug-toggle"
        title="Debug tools"
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
      >
        <Bug className="size-5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">Debug mode</p>
          <p className="text-xs text-muted-foreground">
            Enabled by <code>?debug=true</code>.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          className="w-full gap-2"
          data-testid="global-run-click-sweep"
          disabled={isSweepRunning}
          onClick={runClickSweep}
        >
          {isSweepRunning ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          {isSweepRunning ? "Running click sweep" : "Run click-everywhere sweep"}
        </Button>

        {sweepRanAt && (
          <p className="text-xs text-muted-foreground">
            Last run {sweepRanAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}

        {!!sweepResults.length && (
          <div className="max-h-64 space-y-2 overflow-auto rounded-md border border-border/60 p-2">
            {sweepResults.map((result, index) => (
              <div
                key={`${result.label}-${index}`}
                className={cn(
                  "rounded-md px-2 py-1.5 text-xs",
                  result.passed
                    ? "border border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border border-destructive/20 bg-destructive/10 text-destructive"
                )}
              >
                <div className="font-medium">{result.passed ? "PASS" : "FAIL"}: {result.label}</div>
                <div>{result.detail}</div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
