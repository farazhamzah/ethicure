import { useMemo, useState, useEffect, type ComponentType } from "react"
import { useNavigate } from "react-router-dom"
import {
  Activity,
  ArrowLeft,
  Droplet,
  Flame,
  HeartPulse,
  MoonStar,
  Stethoscope,
  Watch,
} from "lucide-react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const filterOptions = ["daily", "weekly", "monthly", "6m", "yearly"] as const

type MetricIcon = ComponentType<{ className?: string }>

const metricSeries = [
  {
    key: "heartRate",
    title: "Heart Rate",
    unit: "bpm",
    color: "hsl(160 55% 48%)",
    icon: HeartPulse as MetricIcon,
    data: [
      { date: "2025-09-01", value: 71 },
      { date: "2025-09-15", value: 69 },
      { date: "2025-10-01", value: 72 },
      { date: "2025-10-15", value: 74 },
      { date: "2025-11-01", value: 70 },
      { date: "2025-11-15", value: 68 },
      { date: "2025-12-01", value: 70 },
      { date: "2025-12-15", value: 71 },
      { date: "2026-01-01", value: 72 },
      { date: "2026-01-15", value: 70 },
      { date: "2026-02-01", value: 69 },
      { date: "2026-02-11", value: 70 },
    ],
  },
  {
    key: "bloodPressure",
    title: "Blood Pressure",
    unit: "mmHg",
    color: "hsl(210 60% 55%)",
    icon: Stethoscope as MetricIcon,
    data: [
      { date: "2025-09-01", value: 124 },
      { date: "2025-09-15", value: 122 },
      { date: "2025-10-01", value: 125 },
      { date: "2025-10-15", value: 123 },
      { date: "2025-11-01", value: 126 },
      { date: "2025-11-15", value: 124 },
      { date: "2025-12-01", value: 122 },
      { date: "2025-12-15", value: 121 },
      { date: "2026-01-01", value: 123 },
      { date: "2026-01-15", value: 122 },
      { date: "2026-02-01", value: 124 },
      { date: "2026-02-11", value: 123 },
    ],
  },
  {
    key: "glucose",
    title: "Glucose",
    unit: "mg/dL",
    color: "hsl(260 55% 58%)",
    icon: Droplet as MetricIcon,
    data: [
      { date: "2025-09-01", value: 102 },
      { date: "2025-09-15", value: 98 },
      { date: "2025-10-01", value: 100 },
      { date: "2025-10-15", value: 104 },
      { date: "2025-11-01", value: 101 },
      { date: "2025-11-15", value: 97 },
      { date: "2025-12-01", value: 96 },
      { date: "2025-12-15", value: 99 },
      { date: "2026-01-01", value: 97 },
      { date: "2026-01-15", value: 95 },
      { date: "2026-02-01", value: 96 },
      { date: "2026-02-11", value: 98 },
    ],
  },
  {
    key: "stepCount",
    title: "Step Count",
    unit: "steps",
    color: "hsl(140 55% 48%)",
    icon: Activity as MetricIcon,
    data: [
      { date: "2025-09-01", value: 8200 },
      { date: "2025-09-15", value: 9100 },
      { date: "2025-10-01", value: 9800 },
      { date: "2025-10-15", value: 10200 },
      { date: "2025-11-01", value: 8700 },
      { date: "2025-11-15", value: 9200 },
      { date: "2025-12-01", value: 9600 },
      { date: "2025-12-15", value: 10100 },
      { date: "2026-01-01", value: 10500 },
      { date: "2026-01-15", value: 9800 },
      { date: "2026-02-01", value: 9900 },
      { date: "2026-02-11", value: 10300 },
    ],
  },
  {
    key: "oxygen",
    title: "Oxygen",
    unit: "%",
    color: "hsl(190 55% 50%)",
    icon: Droplet as MetricIcon,
    data: [
      { date: "2025-09-01", value: 97.6 },
      { date: "2025-09-15", value: 97.9 },
      { date: "2025-10-01", value: 98.1 },
      { date: "2025-10-15", value: 97.8 },
      { date: "2025-11-01", value: 98.0 },
      { date: "2025-11-15", value: 98.2 },
      { date: "2025-12-01", value: 97.9 },
      { date: "2025-12-15", value: 98.1 },
      { date: "2026-01-01", value: 98.0 },
      { date: "2026-01-15", value: 98.2 },
      { date: "2026-02-01", value: 98.3 },
      { date: "2026-02-11", value: 98.1 },
    ],
  },
  {
    key: "calories",
    title: "Calories",
    unit: "kcal",
    color: "hsl(25 65% 55%)",
    icon: Flame as MetricIcon,
    data: [
      { date: "2025-09-01", value: 1850 },
      { date: "2025-09-15", value: 1920 },
      { date: "2025-10-01", value: 1880 },
      { date: "2025-10-15", value: 1950 },
      { date: "2025-11-01", value: 1820 },
      { date: "2025-11-15", value: 1890 },
      { date: "2025-12-01", value: 1930 },
      { date: "2025-12-15", value: 1870 },
      { date: "2026-01-01", value: 1910 },
      { date: "2026-01-15", value: 1840 },
      { date: "2026-02-01", value: 1865 },
      { date: "2026-02-11", value: 1905 },
    ],
  },
  {
    key: "sleep",
    title: "Sleep",
    unit: "hrs",
    color: "hsl(200 50% 55%)",
    icon: MoonStar as MetricIcon,
    data: [
      { date: "2025-09-01", value: 7.1 },
      { date: "2025-09-15", value: 7.4 },
      { date: "2025-10-01", value: 7.2 },
      { date: "2025-10-15", value: 7.5 },
      { date: "2025-11-01", value: 7.0 },
      { date: "2025-11-15", value: 7.2 },
      { date: "2025-12-01", value: 7.3 },
      { date: "2025-12-15", value: 7.6 },
      { date: "2026-01-01", value: 7.4 },
      { date: "2026-01-15", value: 7.1 },
      { date: "2026-02-01", value: 7.2 },
      { date: "2026-02-11", value: 7.3 },
    ],
  },
  {
    key: "watch",
    title: "Smart Watch Summary",
    unit: "score",
    color: "hsl(250 50% 60%)",
    icon: Watch as MetricIcon,
    data: [
      { date: "2025-09-01", value: 82 },
      { date: "2025-09-15", value: 84 },
      { date: "2025-10-01", value: 83 },
      { date: "2025-10-15", value: 85 },
      { date: "2025-11-01", value: 86 },
      { date: "2025-11-15", value: 84 },
      { date: "2025-12-01", value: 85 },
      { date: "2025-12-15", value: 86 },
      { date: "2026-01-01", value: 87 },
      { date: "2026-01-15", value: 86 },
      { date: "2026-02-01", value: 88 },
      { date: "2026-02-11", value: 89 },
    ],
  },
]

type FilterValue = (typeof filterOptions)[number]

export default function HealthDataPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<FilterValue>("monthly")
  const [latestByType, setLatestByType] = useState<Record<string, any>>({})
  const [readingsRows, setReadingsRows] = useState<any[]>([])

  useEffect(() => {
    let cancelled = false

      async function loadLatest() {
      try {
        const storedPatientId = typeof window !== "undefined" ? Number(window.localStorage.getItem("patientId") || "") : undefined
        const { listReadings } = await import("@/lib/api")
        // request a larger window (past 12 months) so 6M/yearly buckets are populated
        const since = new Date()
        since.setDate(since.getDate() - 365)
        const rows = await listReadings({ startDate: since.toISOString().slice(0,10), limit: 5000, patientId: storedPatientId })

        if (cancelled) return

        // pick latest reading per metric_type
        const sorted = [...rows].sort((a, b) => {
          const la = a.recorded_at ? new Date(a.recorded_at).getTime() : 0
          const lb = b.recorded_at ? new Date(b.recorded_at).getTime() : 0
          return lb - la
        })

        const map: Record<string, any> = {}
        for (const r of sorted) {
          if (!r.metric_type) continue
          if (!(r.metric_type in map)) map[r.metric_type] = r
        }

        if (!cancelled) {
          setLatestByType(map)
          setReadingsRows(rows)
        }
      } catch (err) {
        // ignore failures silently; keep defaults
      }
    }

    loadLatest()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredMetrics = useMemo(() => {
    const now = new Date()

    return metricSeries.map((metric) => {
      // create a shallow copy so we can override the latest data point with real readings
      const metricCopy = { ...metric, data: metric.data.slice() }

      // map metric keys to backend metric_types
      const mapKeyToTypes: Record<string, string[]> = {
        heartRate: ["heart_rate"],
        bloodPressure: ["bp_systolic", "bp_diastolic", "blood_pressure"],
        glucose: ["glucose"],
        stepCount: ["steps"],
        oxygen: ["oxygen"],
        calories: ["calories"],
      }

      const types = mapKeyToTypes[metric.key] ?? []
      let latestNumeric: number | null = null
      let bpSystolic: number | null = null
      let bpDiastolic: number | null = null

      for (const t of types) {
        const r = latestByType[t]
        if (!r) continue
        if (t === "bp_systolic" || t === "bp_diastolic") {
          const n = Number(r.value ?? (t === "bp_systolic" ? r.systolic : r.diastolic))
          if (Number.isFinite(n)) {
            if (t === "bp_systolic") bpSystolic = n
            if (t === "bp_diastolic") bpDiastolic = n
            latestNumeric = latestNumeric ?? n
          }
        } else if (typeof r.value !== "undefined" && r.value !== null) {
          const n = Number(r.value)
          if (Number.isFinite(n)) latestNumeric = latestNumeric ?? n
        }
      }

      // override the last point in metric data so generated series uses real latest value
      if (metricCopy.data.length) {
        const lastIdx = metricCopy.data.length - 1
        if (latestNumeric !== null) {
          metricCopy.data[lastIdx] = { ...metricCopy.data[lastIdx], value: latestNumeric }
        }
      }

      // prefer using real readings when available
      const series = readingsRows.length
        ? buildSeriesFromRows(metric.key, filter, now, readingsRows)
        : buildSeries(metricCopy, filter, now)
      const values = series.map((d) => d.value)
      const min = Math.min(...values)
      const max = Math.max(...values)
      const avg = Number(
        (values.reduce((acc, v) => acc + v, 0) / values.length).toFixed(1)
      )

      // compute a display-friendly latest value (blood pressure shows systolic/diastolic if available)
      let displayLatest: string | number | undefined = series[series.length - 1]?.value
      if (metric.key === "bloodPressure") {
        if (bpSystolic !== null && bpDiastolic !== null) {
          displayLatest = `${bpSystolic}/${bpDiastolic}`
        } else if (bpSystolic !== null) {
          displayLatest = bpSystolic
        }
      }

      return {
        ...metric,
        series,
        summary: { min, max, avg },
        displayLatest,
      }
    })
  }, [filter, latestByType])

  function buildSeriesFromRows(
    metricKey: string,
    filter: FilterValue,
    now: Date,
    rows: any[]
  ) {
    if (!rows || !rows.length) return buildSeries(metricSeries.find(m => m.key === metricKey)!, filter, now)

    const mapKeyToTypes: Record<string, string[]> = {
      heartRate: ["heart_rate"],
      bloodPressure: ["bp_systolic", "bp_diastolic", "blood_pressure"],
      glucose: ["glucose"],
      stepCount: ["steps"],
      oxygen: ["oxygen"],
      calories: ["calories"],
    }

    const types = mapKeyToTypes[metricKey] ?? []
    const normalizeType = (s: string) =>
      (s || "")
        .toString()
        // convert camelCase to snake_case (e.g. bpSystolic -> bp_systolic)
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/[- ]/g, "_")
        .toLowerCase()
    const normalizedTypes = types.map(normalizeType)

    // key formatter depending on granularity
    const keyForDate = (d: Date) => {
      if (filter === "daily") return d.toISOString().slice(0,13) // YYYY-MM-DDTHH
      if (filter === "weekly" || filter === "monthly") return d.toISOString().slice(0,10) // YYYY-MM-DD
      // 6m/yearly -> monthly bucket
      return d.toISOString().slice(0,7) // YYYY-MM
    }

    // build grouping: simple per-bucket averages for all metrics
    const buckets = new Map<string, number[]>()
    const datesPresent = new Set<string>()
    for (const r of rows) {
      const rawType = r.metric_type ?? r.metricType ?? r.type ?? ""
      if (!rawType) continue
      const rt = normalizeType(rawType)
      if (!normalizedTypes.includes(rt)) continue
      const recorded = r.recorded_at ? new Date(r.recorded_at) : null
      if (!recorded) continue
      // align recorded date to bucket
      const key = keyForDate(recorded)
      let val: number | null = null
      if (r.metric_type === "bp_systolic" || r.metric_type === "bp_diastolic") {
        val = Number(r.value ?? (r.systolic ?? r.diastolic) ?? null)
      } else {
        val = Number(r.value ?? (r.systolic ?? r.diastolic) ?? null)
      }
      if (!Number.isFinite(val)) continue
      datesPresent.add(key)
      const arr = buckets.get(key) ?? []
      arr.push(val)
      buckets.set(key, arr)
    }

    if (!buckets.size) return buildSeries(metricSeries.find(m => m.key === metricKey)!, filter, now)

    // compute averages per bucket (simple month average)
    const averaged = new Map<string, number>()
    const keys = Array.from(buckets.keys()).sort()
    for (const k of keys) {
      const arr = buckets.get(k) || []
      if (!arr.length) continue
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length
      averaged.set(k, Number(avg.toFixed(1)))
    }

    // build date range
    const series: { date: string; value: number | null }[] = []
    const firstKey = keys[0]

    if (filter === "daily") {
      for (let i = 0; i < 24; i++) {
        const d = new Date(now)
        d.setHours(now.getHours() - (23 - i), 0, 0, 0)
        const k = keyForDate(d)
        const v = averaged.get(k)
        // leave missing points as null so chart shows gaps instead of flat lines
        const value = v !== undefined ? v : null
        series.push({ date: d.toISOString(), value })
      }
      return series
    }

    if (filter === "weekly") {
      for (let i = 0; i < 7; i++) {
        const d = new Date(now)
        d.setDate(now.getDate() - (6 - i))
        const k = keyForDate(d)
        const v = averaged.get(k)
        const value = v !== undefined ? v : null
        series.push({ date: d.toISOString(), value })
      }
      return series
    }

    if (filter === "monthly") {
      for (let i = 0; i < 30; i++) {
        const d = new Date(now)
        d.setDate(now.getDate() - (29 - i))
        const k = keyForDate(d)
        const v = averaged.get(k)
        const value = v !== undefined ? v : null
        series.push({ date: d.toISOString(), value })
      }
      return series
    }

    if (filter === "6m") {
      for (let i = 0; i < 6; i++) {
        const d = new Date(now)
        d.setMonth(now.getMonth() - (5 - i), 1)
        const k = keyForDate(d)
        const v = averaged.get(k)
        const value = v !== undefined ? v : null
        series.push({ date: d.toISOString(), value })
      }
      return series
    }

    // yearly
    for (let i = 0; i < 12; i++) {
      const d = new Date(now)
      d.setMonth(now.getMonth() - (11 - i), 1)
      const k = keyForDate(d)
      const v = averaged.get(k)
      const value = v !== undefined ? v : null
      series.push({ date: d.toISOString(), value })
    }

    return series
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <span className="hidden sm:inline">Overview</span>
            </div>
            <h1 className="text-lg font-semibold">All Health Data</h1>
          </div>
          <Tabs
            value={filter}
            onValueChange={(value) => setFilter(value as FilterValue)}
            className="w-full max-w-md"
          >
            <TabsList className="w-full justify-end overflow-x-auto whitespace-nowrap px-1" variant="line">
              <TabsTrigger value="daily" className="px-3 text-xs">Daily</TabsTrigger>
              <TabsTrigger value="weekly" className="px-3 text-xs">Weekly</TabsTrigger>
              <TabsTrigger value="monthly" className="px-3 text-xs">Monthly</TabsTrigger>
              <TabsTrigger value="6m" className="px-3 text-xs">6M</TabsTrigger>
              <TabsTrigger value="yearly" className="px-3 text-xs">Yearly</TabsTrigger>
            </TabsList>
            <TabsContent value={filter} />
          </Tabs>
        </div>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Clinical, compact view of key metrics. Charts adapt to screen and timeframe.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {filteredMetrics.map((metric) => {
          if (metric.key === "watch") return null
          const chartConfig = {
            [metric.key]: {
              label: metric.title,
              color: metric.color,
            },
          } satisfies ChartConfig

          const avgDisplay = (metric as any).summary?.avg ?? metric.series[metric.series.length - 1]?.value

          return (
            <Card key={metric.key} className="h-full border-border/60 bg-card/70 shadow-xs">
              <CardHeader className="gap-1 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/60">
                        <metric.icon className="h-4 w-4" />
                      </span>
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {metric.title}
                      </CardTitle>
                    </div>
                    <div className="text-2xl font-semibold tracking-tight">
                      {avgDisplay}
                      {metric.unit ? <span className="ml-1 text-base text-muted-foreground">{metric.unit}</span> : null}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">{filterLabel(filter)}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Min {metric.summary.min}{metric.unit ? ` ${metric.unit}` : ""} · Max {metric.summary.max}{metric.unit ? ` ${metric.unit}` : ""} · Avg {metric.summary.avg}{metric.unit ? ` ${metric.unit}` : ""}
                </p>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="h-[200px] rounded-lg border border-border/70 bg-muted/30 p-1.5">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metric.series} margin={{ left: 6, right: 6, top: 6, bottom: 6 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(0 0% 80% / 0.3)" />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          minTickGap={24}
                          tickFormatter={(value) => formatLabel(value, filter)}
                          className="text-xs text-muted-foreground"
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={42}
                          tickMargin={6}
                          domain={computeDomain(metric.summary)}
                          className="text-xs text-muted-foreground"
                        />
                        <ChartTooltip
                          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                          content={
                            <ChartTooltipContent
                              indicator="dot"
                              labelFormatter={(value) => formatTooltip(value, filter)}
                            />
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={`var(--color-${metric.key})`}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 3.5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function filterLabel(value: FilterValue) {
  if (value === "6m") return "6 months"
  if (value === "yearly") return "Yearly"
  if (value === "monthly") return "Monthly"
  if (value === "weekly") return "Weekly"
  return "Daily"
}

function computeDomain(summary: { min: number; max: number }) {
  const span = Math.max(1, summary.max - summary.min)
  const pad = span * 0.15
  const lower = Math.max(0, summary.min - pad)
  const upper = summary.max + pad
  return [Number(lower.toFixed(1)), Number(upper.toFixed(1))]
}

function buildSeries(
  metric: (typeof metricSeries)[number],
  filter: FilterValue,
  now: Date
) {
  const latestValue = metric.data[metric.data.length - 1]?.value ?? 0

  const generators: Record<FilterValue, () => { date: string; value: number }[]> = {
    daily: () => {
      // 24 hourly points for past 24h
      return Array.from({ length: 24 }).map((_, idx) => {
        const d = new Date(now)
        d.setHours(now.getHours() - (23 - idx), 0, 0, 0)
        const variance = 0.5 * Math.sin(idx * 0.6 + metric.key.length)
        return { date: d.toISOString(), value: Number((latestValue + variance).toFixed(1)) }
      })
    },
    weekly: () => {
      // current day + last 6 days
      return Array.from({ length: 7 }).map((_, idx) => {
        const d = new Date(now)
        d.setDate(now.getDate() - (6 - idx))
        const variance = 1.2 * Math.sin(idx * 0.8 + metric.key.length)
        return { date: d.toISOString(), value: Number((latestValue + variance).toFixed(1)) }
      })
    },
    monthly: () => {
      // last 30 days
      return Array.from({ length: 30 }).map((_, idx) => {
        const d = new Date(now)
        d.setDate(now.getDate() - (29 - idx))
        const variance = 2 * Math.sin(idx * 0.25 + metric.key.length)
        return { date: d.toISOString(), value: Number((latestValue + variance).toFixed(1)) }
      })
    },
    "6m": () => {
      // 6 months back, monthly points
      return Array.from({ length: 6 }).map((_, idx) => {
        const d = new Date(now)
        d.setMonth(now.getMonth() - (5 - idx), 1)
        const variance = 3 * Math.sin(idx * 0.6 + metric.key.length)
        return { date: d.toISOString(), value: Number((latestValue + variance).toFixed(1)) }
      })
    },
    yearly: () => {
      // 12 months back, monthly points
      return Array.from({ length: 12 }).map((_, idx) => {
        const d = new Date(now)
        d.setMonth(now.getMonth() - (11 - idx), 1)
        const variance = 3.5 * Math.sin(idx * 0.5 + metric.key.length)
        return { date: d.toISOString(), value: Number((latestValue + variance).toFixed(1)) }
      })
    },
  }

  return generators[filter]()
}

function formatLabel(value: string, filter: FilterValue) {
  const date = new Date(value)
  if (filter === "daily") {
    return date.toLocaleTimeString("en-US", { hour: "numeric" })
  }
  if (filter === "weekly" || filter === "monthly") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }
  // 6m, yearly
  return date.toLocaleDateString("en-US", { month: "short" })
}

function formatTooltip(value: string, filter: FilterValue) {
  const date = new Date(value)
  if (filter === "daily") {
    return date.toLocaleString("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    })
  }
  if (filter === "weekly" || filter === "monthly") {
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  }
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}
