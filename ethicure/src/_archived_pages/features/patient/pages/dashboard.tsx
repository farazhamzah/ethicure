"use client"

import { TrendingUp } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartData = [
  { month: "Jan", value: 186 },
  { month: "Feb", value: 305 },
  { month: "Mar", value: 237 },
  { month: "Apr", value: 73 },
  { month: "May", value: 209 },
  { month: "Jun", value: 214 },
]

const chartConfig = {
  value: {
    label: "Value",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

function MiniChartCard({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium">
          {title}
        </CardTitle>
        <CardDescription className="text-[11px] text-green-600">
          Normal
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <ChartContainer
          config={chartConfig}
          className="h-[90px]"
        >
          <AreaChart data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Area
              dataKey="value"
              type="natural"
              fill="var(--color-value)"
              fillOpacity={0.25}
              stroke="var(--color-value)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>

      <CardFooter className="pt-1 text-[11px] text-muted-foreground">
        <TrendingUp className="mr-1 h-3 w-3" />
        Stable
      </CardFooter>
    </Card>
  )
}

export default function Dashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-12 gap-3">
        {/* LEFT: 3 charts */}
        <div className="col-span-12 md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MiniChartCard title="Heart Rate" />
          <MiniChartCard title="Blood Sugar" />
          <MiniChartCard title="Steps" />
        </div>

        {/* RIGHT: vertical 2 charts */}
        <div className="col-span-12 md:col-span-4 grid gap-3">
          <MiniChartCard title="Calories" />
          <MiniChartCard title="Oxygen" />
        </div>
      </div>
    </div>
  )
}
