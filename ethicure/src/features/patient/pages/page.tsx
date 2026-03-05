import * as React from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function Page() {
  const [streakDate, setStreakDate] = React.useState<Date | undefined>(
    new Date()
  )
  const streakCurrent = 12
  const streakGoal = 30
  const streakPercent = Math.min(
    100,
    Math.round((streakCurrent / streakGoal) * 100)
  )

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              <div className="px-4 lg:px-6">
                <Card className="shadow-xs">
                  <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Streaks Calendar</CardTitle>
                      <CardDescription>
                        Pick days to keep your streak going.
                      </CardDescription>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {streakDate
                        ? streakDate.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "No day selected"}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Calendar
                      mode="single"
                      selected={streakDate}
                      onSelect={setStreakDate}
                      className="rounded-lg border"
                    />
                    <div className="mt-6 space-y-2">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>Streak progress</span>
                        <span className="text-muted-foreground">
                          {streakCurrent} / {streakGoal} days
                        </span>
                      </div>
                      <div
                        className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={streakGoal}
                        aria-valuenow={streakCurrent}
                        aria-label="Streak progress"
                      >
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${streakPercent}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
