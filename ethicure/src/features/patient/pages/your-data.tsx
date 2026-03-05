"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Sparkles } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { listReadings, type ReadingRow } from "@/lib/api"

type MetricType = "heart_rate" | "bp_systolic" | "bp_diastolic" | "glucose" | "steps" | "calories" | "oxygen"

type TrendPoint = { date: string; value: number; target?: number }

type MetricLeaf = {
  id: MetricType
  label: string
  description: string
  unit: string
  color: string
  target?: number
}

type MetricGroup = {
  id: string
  label: string
  description: string
  children: MetricLeaf[]
}

const METRIC_GROUPS: MetricGroup[] = [
  {
    id: "heart-rate",
    label: "Heart Rate",
    description: "Resting heart rate over time.",
    children: [
      {
        id: "heart_rate",
        label: "BPM",
        description: "Resting heart rate",
        unit: "bpm",
        color: "#16a34a",
        target: 70,
      },
    ],
  },
  {
    id: "blood-pressure",
    label: "Blood Pressure",
    description: "Systolic and diastolic trends.",
    children: [
      {
        id: "bp_systolic",
        label: "Systolic",
        description: "Peak pressure",
        unit: "mmHg",
        color: "#0ea5e9",
        target: 120,
      },
      {
        id: "bp_diastolic",
        label: "Diastolic",
        description: "Resting pressure",
        unit: "mmHg",
        color: "#06b6d4",
        target: 80,
      },
    ],
  },
  {
    id: "glucose",
    label: "Glucose",
    description: "Glycemic control snapshots.",
    children: [
      {
        id: "glucose",
        label: "Glucose",
        description: "Spot glucose readings",
        unit: "mg/dL",
        color: "#f97316",
        target: 105,
      },
    ],
  },
  {
    id: "steps",
    label: "Steps",
    description: "Movement consistency and cadence.",
    children: [
      {
        id: "steps",
        label: "Steps",
        description: "Daily totals",
        unit: "steps",
        color: "#0ea5e9",
        target: 9000,
      },
    ],
  },
  {
    id: "calories",
    label: "Calories",
    description: "Energy expenditure.",
    children: [
      {
        id: "calories",
        label: "Calories",
        description: "Total calories",
        unit: "kcal",
        color: "#db2777",
        target: 2200,
      },
    ],
  },
  {
    id: "oxygen",
    label: "Oxygen",
    description: "SpO2 readings.",
    children: [
      {
        id: "oxygen",
        label: "SpO2",
        description: "Avg saturation",
        unit: "%",
        color: "#22c55e",
        target: 97,
      },
    ],
  },
]

const DEFAULT_GROUP_ID = METRIC_GROUPS[0]?.id ?? ""

const DEFAULT_LEAF_ID = (() => {
  const group = METRIC_GROUPS.find((item) => item.id === DEFAULT_GROUP_ID) ?? METRIC_GROUPS[0]
  return (
    group?.children[0]?.id ?? ""
  )
})()

const TIME_RANGES: Record<string, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  sixMonths: 180,
  yearly: 365,
}

export default function YourDataPage() {
  const [groupId, setGroupId] = React.useState<string>(DEFAULT_GROUP_ID)
  const [leafId, setLeafId] = React.useState<string>(DEFAULT_LEAF_ID)
  const [timeRange, setTimeRange] = React.useState<keyof typeof TIME_RANGES>("monthly")
  const [trendMap, setTrendMap] = React.useState<Record<MetricType, TrendPoint[]>>(() => ({
    heart_rate: [],
    bp_systolic: [],
    bp_diastolic: [],
    glucose: [],
    steps: [],
    calories: [],
    oxygen: [],
  }))
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string | null>(null)

  const chartableGroups = React.useMemo(() => METRIC_GROUPS, [])

  const firstChartableLeaf = React.useMemo(() => {
    const group = chartableGroups[0]
    if (!group) return null
    const leaf = group.children[0]
    return leaf ? { groupId: group.id, leafId: leaf.id } : null
  }, [chartableGroups])

  const currentGroup = React.useMemo(
    () => METRIC_GROUPS.find((group) => group.id === groupId) ?? METRIC_GROUPS[0],
    [groupId]
  )

  const availableLeaves = React.useMemo(() => currentGroup?.children ?? [], [currentGroup])

  React.useEffect(() => {
    if (availableLeaves.length && availableLeaves.find((leaf) => leaf.id === leafId)) {
      return
    }

    if (availableLeaves.length) {
      setLeafId(availableLeaves[0].id)
      return
    }

    if (firstChartableLeaf) {
      setGroupId(firstChartableLeaf.groupId)
      setLeafId(firstChartableLeaf.leafId)
    }
  }, [availableLeaves, leafId, firstChartableLeaf])

  const selectedLeaf = React.useMemo(
    () => availableLeaves.find((leaf) => leaf.id === leafId) ?? availableLeaves[0],
    [availableLeaves, leafId]
  )

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const storedPatientId =
          typeof window !== "undefined"
            ? Number(window.localStorage.getItem("patientId") || "")
            : undefined

        if (!storedPatientId) {
          throw new Error("Missing patient session. Please sign in again.")
        }

        const since = new Date()
        since.setDate(since.getDate() - 365)
        const rows = await listReadings({
          patientId: storedPatientId,
          startDate: since.toISOString().slice(0, 10),
          limit: 5000,
        })

        if (cancelled) return
        setTrendMap(buildTrendMap(rows))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load data")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredTrend = React.useMemo(() => {
    if (!selectedLeaf) return []
    const series = trendMap[selectedLeaf.id] ?? []
    if (!series.length) return []

    const days = TIME_RANGES[timeRange]
    const cutoff = new Date()
    cutoff.setHours(0, 0, 0, 0)
    cutoff.setDate(cutoff.getDate() - days + 1)

    const within = series.filter((row) => new Date(row.date) >= cutoff)
    const chosen = within.length ? within : series.slice(-14)
    return chosen.map((row) => ({ ...row, target: selectedLeaf.target }))
  }, [selectedLeaf, timeRange, trendMap])

  const currentValue = filteredTrend.at(-1)?.value
  const startingValue = filteredTrend[0]?.value
  const delta =
    currentValue !== undefined && startingValue !== undefined
      ? currentValue - startingValue
      : undefined

  const chartConfig = React.useMemo(() => {
    return {
      value: {
        label: selectedLeaf?.label ?? "Metric",
        color: "var(--primary)",
      },
      target: {
        label: "Target",
        color: "var(--muted-foreground)",
      },
    } satisfies ChartConfig
  }, [selectedLeaf])

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Insights</p>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Your Data</h1>
          <p className="text-sm text-muted-foreground">
            Pick a metric and sub-metric to see the trajectory over time.
          </p>
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </header>

      <Card className="border border-border/70 bg-card">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Metric Trends</CardTitle>
              <CardDescription>
                Choose the stream and sub-signal to plot. Daily, weekly, monthly, 6M, and yearly views.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={groupId}
                onValueChange={(value) => setGroupId(value ?? groupId)}
              >
                <SelectTrigger className="w-44" size="sm">
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {METRIC_GROUPS.map((group) => (
                    <SelectItem key={group.id} value={group.id} className="rounded-lg">
                      {group.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedLeaf?.id ?? leafId}
                onValueChange={(value) => setLeafId(value ?? leafId)}
                disabled={!availableLeaves.length}
              >
                <SelectTrigger className="w-44" size="sm">
                  <SelectValue placeholder="Select sub-metric" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {availableLeaves.map((leaf) => (
                    <SelectItem key={leaf.id} value={leaf.id} className="rounded-lg">
                      {leaf.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ToggleGroup
                value={[timeRange]}
                onValueChange={(values) => {
                  const next = values[0]
                  if (next) setTimeRange(next as keyof typeof TIME_RANGES)
                }}
                variant="outline"
                className="hidden *:data-[slot=toggle-group-item]:!px-3 lg:flex"
              >
                <ToggleGroupItem value="daily">Daily</ToggleGroupItem>
                <ToggleGroupItem value="weekly">Weekly</ToggleGroupItem>
                <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
                <ToggleGroupItem value="sixMonths">6M</ToggleGroupItem>
                <ToggleGroupItem value="yearly">Yearly</ToggleGroupItem>
              </ToggleGroup>
              <Select
                value={timeRange}
                onValueChange={(value) =>
                  setTimeRange((value as keyof typeof TIME_RANGES) || timeRange)
                }
              >
                <SelectTrigger className="w-28 lg:hidden" size="sm">
                  <SelectValue placeholder="Range" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="daily">Daily (24h)</SelectItem>
                  <SelectItem value="weekly">Weekly (7 days)</SelectItem>
                  <SelectItem value="monthly">Monthly (30 days)</SelectItem>
                  <SelectItem value="sixMonths">6M (180 days)</SelectItem>
                  <SelectItem value="yearly">Yearly (12 months)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <InsightPill
              title="Current"
              value={
                currentValue !== undefined
                  ? formatValue(currentValue, selectedLeaf?.unit ?? "")
                  : "--"
              }
              icon={<Sparkles className="h-4 w-4" />}
            />
            <InsightPill
              title="Change"
              value={delta !== undefined ? formatDelta(delta) : "--"}
              tone={delta !== undefined && delta >= 0 ? "positive" : "caution"}
              icon={
                delta !== undefined && delta >= 0 ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )
              }
            />
            <InsightPill
              title="Target"
              value={
                selectedLeaf?.target !== undefined
                  ? formatValue(selectedLeaf.target as number, selectedLeaf.unit ?? "")
                  : "Not set"
              }
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {currentGroup?.description} - {selectedLeaf?.description}
          </p>
        </CardHeader>
        <CardContent className="px-2 pb-6 sm:px-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading data…</p>
          ) : !filteredTrend.length ? (
            <p className="text-sm text-muted-foreground">No readings yet in this range.</p>
          ) : (
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-[260px] w-full rounded-xl bg-muted/30 sm:h-[320px]"
            >
              <AreaChart data={filteredTrend}>
                <defs>
                  <linearGradient id="fillMetric" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    if (timeRange === "daily") {
                      return date.toLocaleTimeString("en-US", { hour: "numeric" })
                    }
                    if (timeRange === "yearly") {
                      return date.toLocaleDateString("en-US", { month: "short" })
                    }
                    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  }}
                />
                <YAxis
                  width={54}
                  tickMargin={6}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatValue(value, selectedLeaf?.unit ?? "")}
                />
                {selectedLeaf?.target !== undefined && (
                  <ReferenceLine
                    y={selectedLeaf?.target}
                    stroke="var(--color-target)"
                    strokeDasharray="4 4"
                    ifOverflow="extendDomain"
                  />
                )}
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) =>
                        new Date(value).toLocaleDateString("en-US", {
                          month: "short",
                          day: timeRange === "yearly" ? undefined : "numeric",
                          hour: timeRange === "daily" ? "numeric" : undefined,
                        })
                      }
                      formatter={(value) => formatValue(Number(value), selectedLeaf?.unit ?? "")}
                    />
                  }
                />
                {selectedLeaf?.target !== undefined && (
                  <Area
                    dataKey="target"
                    type="monotone"
                    stroke="var(--color-target)"
                    fillOpacity={0}
                    strokeDasharray="4 4"
                    dot={false}
                    name="Target"
                  />
                )}
                <Area
                  dataKey="value"
                  type="monotone"
                  fill="url(#fillMetric)"
                  stroke="var(--color-value)"
                  strokeWidth={2}
                  name={selectedLeaf?.label}
                />
                <ChartLegend
                  verticalAlign="top"
                  content={<ChartLegendContent className="pt-0" />}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function formatValue(value: number | string, unit: string) {
  if (typeof value === "string") return value
  const numeric = Number.isInteger(value) ? value : Number(value.toFixed(1))

  switch (unit) {
    case "bpm":
      return `${numeric} bpm`
    case "mmHg":
      return `${numeric} mmHg`
    case "mg/dL":
      return `${numeric} mg/dL`
    case "%":
      return `${numeric}%`
    case "min":
      return `${numeric} min`
    case "kcal":
      return `${numeric} kcal`
    case "steps":
      return `${numeric.toLocaleString()} steps`
    default:
      return String(numeric)
  }
}

function formatDelta(delta: number) {
  const sign = delta >= 0 ? "+" : "-"
  return `${sign}${Math.abs(delta).toFixed(1)}`
}

function isMetricType(value: string): value is MetricType {
  return ["heart_rate", "bp_systolic", "bp_diastolic", "glucose", "steps", "calories", "oxygen"].includes(value)
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function buildTrendMap(rows: ReadingRow[]): Record<MetricType, TrendPoint[]> {
  const buckets: Partial<Record<MetricType, Map<string, number[]>>> = {}

  rows.forEach((row) => { 
    const metric = row.metric_type
    if (!isMetricType(metric)) return
    const num = toNumber(row.value)
    if (num === null) return
    const dateKey = row.recorded_at ? new Date(row.recorded_at).toISOString().slice(0, 10) : null
    if (!dateKey) return

    if (!buckets[metric]) buckets[metric] = new Map<string, number[]>()
    const bucket = buckets[metric]!
    const existing = bucket.get(dateKey) ?? []
    existing.push(num)
    bucket.set(dateKey, existing)
  })

  const trendMap: Record<MetricType, TrendPoint[]> = {
    heart_rate: [],
    bp_systolic: [],
    bp_diastolic: [],
    glucose: [],
    steps: [],
    calories: [],
    oxygen: [],
  }

  Object.entries(buckets).forEach(([metric, bucket]) => {
    if (!bucket) return
    const series = Array.from(bucket.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([date, values]) => ({
        date,
        value: values.reduce((sum, val) => sum + val, 0) / values.length,
      }))
    trendMap[metric as MetricType] = series
  })

  return trendMap
}

function InsightPill({
  title,
  value,
  icon,
  tone = "default",
}: {
  title: string
  value: string
  icon?: React.ReactNode
  tone?: "default" | "positive" | "caution"
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "caution"
        ? "text-amber-600 dark:text-amber-300"
        : "text-muted-foreground"

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
      {icon && <span className={toneClass}>{icon}</span>}
    </div>
  )
}
