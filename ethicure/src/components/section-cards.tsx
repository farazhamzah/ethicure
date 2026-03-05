import {
  IconHeartRateMonitor,
  IconRun,
  IconFlame,
  IconDroplet,
  IconDeviceWatchStats,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function SectionCards() {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Heart Rate</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            72 bpm
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconHeartRateMonitor />
              Stable
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Resting range maintained
          </div>
          <div className="text-muted-foreground">Good cardiovascular rhythm</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Blood Sugar</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            95 mg/dL
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconDroplet />
              Balanced
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">Within target range</div>
          <div className="text-muted-foreground">No corrective action needed</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Steps</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            8,240 steps
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconRun />
              On pace
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">Daily target on track</div>
          <div className="text-muted-foreground">Consistent activity logged</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Calories</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            1,850 kcal
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconFlame />
              Balanced
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">Intake vs. burn aligned</div>
          <div className="text-muted-foreground">Energy use within goals</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Oxygen</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            98%
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconDeviceWatchStats />
              Stable
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">Healthy saturation range</div>
          <div className="text-muted-foreground">No anomalies detected</div>
        </CardFooter>
      </Card>
    </div>
  )
}
