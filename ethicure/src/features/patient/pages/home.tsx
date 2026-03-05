import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Activity,
  AlertTriangle,
  Bell,
  Brain,
  Droplet,
  Flame,
  HeartPulse,
  MoonStar,
  ArrowRight,
  Sparkles,
  Stethoscope,
} from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

import {
  getAIRecommendations,
  getReadingStats,
  getReadingStreaks,
  listAlerts,
  listReadings,
  getPatientDetail,
  getPatientProfile,
  getPatientPublic,
  type ReadingRow,
  type ReadingStat,
  type PatientProfile,
} from "@/lib/api"
type Status = "Stable" | "Monitor" | "Attention"

function deriveHeartRateStatus(value?: number): Status {
  if (value === undefined) return "Monitor"
  if (value < 50 || value > 110) return "Attention"
  if (value < 60 || value > 90) return "Monitor"
  return "Stable"
}

function deriveBloodPressureStatus(systolic?: number, diastolic?: number): Status {
  if (systolic === undefined || diastolic === undefined) return "Monitor"
  if (systolic >= 140 || diastolic >= 90 || systolic < 90 || diastolic < 60) return "Attention"
  if (systolic >= 130 || diastolic >= 85) return "Monitor"
  return "Stable"
}

function deriveGlucoseStatus(value?: number): Status {
  if (value === undefined) return "Monitor"
  if (value < 70 || value > 180) return "Attention"
  if (value < 80 || value > 140) return "Monitor"
  return "Stable"
}

function deriveOxygenStatus(value?: number): Status {
  if (value === undefined) return "Monitor"
  if (value < 94) return "Attention"
  if (value < 96) return "Monitor"
  return "Stable"
}

function deriveStepsStatus(value?: number): Status {
  if (value === undefined) return "Monitor"
  if (value < 4000) return "Attention"
  if (value < 7500) return "Monitor"
  return "Stable"
}

function deriveEnergyStatus(calories?: number | null, bmi?: number | null): Status {
  if (calories !== undefined && calories !== null) {
    if (calories < 1200 || calories > 3200) return "Attention"
    if (calories < 1600 || calories > 2800) return "Monitor"
    return "Stable"
  }

  if (bmi !== undefined && bmi !== null) {
    if (bmi < 18 || bmi >= 30) return "Attention"
    if (bmi < 19 || bmi >= 25) return "Monitor"
    return "Stable"
  }

  return "Monitor"
}

function buildSnapshotMetrics(metrics: MetricSnapshot) {
  const heartRate = metrics.heartRate !== undefined ? `${metrics.heartRate}` : "—"
  const bloodPressure =
    metrics.systolic !== undefined && metrics.diastolic !== undefined
      ? `${metrics.systolic}/${metrics.diastolic}`
      : "—"
  const glucose = metrics.glucose !== undefined ? `${metrics.glucose}` : "—"
  const oxygen = metrics.oxygen !== undefined ? `${metrics.oxygen}` : "—"
  const steps = metrics.steps !== undefined ? metrics.steps.toLocaleString() : "—"

  return [
    {
      title: "Current Heart Rate",
      value: heartRate,
      unit: heartRate === "—" ? undefined : "bpm",
      status: deriveHeartRateStatus(metrics.heartRate),
      icon: HeartPulse,
    },
    {
      title: "Blood Pressure",
      value: bloodPressure,
      unit: bloodPressure === "—" ? undefined : "mmHg",
      status: deriveBloodPressureStatus(metrics.systolic, metrics.diastolic),
      icon: Stethoscope,
    },
    {
      title: "Glucose",
      value: glucose,
      unit: glucose === "—" ? undefined : "mg/dL",
      status: deriveGlucoseStatus(metrics.glucose),
      icon: Droplet,
    },
    {
      title: "Oxygen",
      value: oxygen,
      unit: oxygen === "—" ? undefined : "%",
      status: deriveOxygenStatus(metrics.oxygen),
      icon: Droplet,
    },
    {
      title: "Steps Today",
      value: steps,
      unit: steps === "—" ? undefined : "steps",
      status: deriveStepsStatus(metrics.steps),
      icon: Activity,
    },
    {
      title: "Calories",
      value:
        metrics.calories !== undefined && metrics.calories !== null
          ? `${Number(metrics.calories).toFixed(1)}`
          : metrics.bmi !== undefined && metrics.bmi !== null
          ? `${Number(metrics.bmi).toFixed(1)}`
          : "—",
      unit: metrics.calories !== undefined && metrics.calories !== null ? "kcal" : undefined,
      status: deriveEnergyStatus(metrics.calories, metrics.bmi),
      icon: Flame,
    },
  ]
}

const defaultStreaks: StreakCard[] = [
  {
    title: "Reading streak",
    current: 0,
    longest: 0,
    goal: 7,
    color: "text-emerald-400",
    accent: "emerald",
  },
]

const defaultCompletionDates = [new Date()]

const defaultRecommendations: Recommendation[] = [
  { title: "Keep syncing readings", detail: "Add a few new measurements to personalize insights." },
]

const defaultAlerts: AlertCard[] = [
  {
    title: "No alerts yet",
    detail: "You have no recent alerts.",
    severity: "low",
    icon: Bell,
  },
]

function buildStability(stats: ReadingStat[]): { cardio: number; metabolic: number; sleep: number; activity: number } | null {
  if (!stats || !stats.length) return null

  const lookup = Object.fromEntries(stats.map((s) => [s.metric_type, s])) as Record<string, ReadingStat>

  const pct = (value: number | null | undefined, min: number, max: number) => {
    if (value === null || value === undefined) return 50
    const clamped = Math.max(min, Math.min(max, value))
    return Math.round(((clamped - min) / (max - min)) * 100)
  }

  const cardio = pct(lookup.heart_rate?.avg_value ?? null, 50, 110)
  const metabolic = pct(lookup.glucose?.avg_value ?? null, 70, 160)
  const activity = pct(lookup.steps?.avg_value ?? null, 2000, 12000)
  const oxygen = pct(lookup.oxygen?.avg_value ?? null, 90, 100)
  const sleep = Math.round((oxygen * 0.4 + cardio * 0.3 + metabolic * 0.3) / 1)

  return {
    cardio,
    metabolic,
    activity,
    sleep,
  }
}

type MetricSnapshot = {
  heartRate?: number
  systolic?: number
  diastolic?: number
  glucose?: number
  oxygen?: number
  steps?: number
  bmi?: number | null
  calories?: number | null
  lastSync?: string | null
}

function mergeMetrics(base: MetricSnapshot, overlay: MetricSnapshot): MetricSnapshot {
  const merged = { ...base }
  for (const [key, value] of Object.entries(overlay)) {
    if (value !== undefined && value !== null) {
      ;(merged as any)[key] = value
    }
  }
  return merged
}

function isToday(timestamp?: string | null, today = new Date()): boolean {
  if (!timestamp) return false
  const date = new Date(timestamp)
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined
  if (value === null || value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function buildLatestMetrics(readings: ReadingRow[]): MetricSnapshot {
  const sorted = [...readings].sort((a, b) => {
    const left = a.recorded_at ? new Date(a.recorded_at).getTime() : 0
    const right = b.recorded_at ? new Date(b.recorded_at).getTime() : 0
    return right - left
  })

  const latestByType = new Map<string, ReadingRow>()
  for (const row of sorted) {
    if (row.metric_type && !latestByType.has(row.metric_type)) {
      latestByType.set(row.metric_type, row)
    }
  }

  const pick = (metric: string) => {
    const match = latestByType.get(metric)
    if (!match) return undefined
    return (
      toNumber(match.value) ??
      toNumber(match.systolic) ??
      toNumber(match.diastolic)
    )
  }

  const latestTimestamp = sorted.find((r) => r.recorded_at)?.recorded_at ?? null

  return {
    heartRate: pick("heart_rate"),
    systolic: pick("bp_systolic"),
    diastolic: pick("bp_diastolic"),
    glucose: pick("glucose"),
    oxygen: pick("oxygen"),
    steps: pick("steps"),
    calories: pick("calories"),
    lastSync: latestTimestamp,
  }
}

function buildStabilityFromMetrics(metrics: MetricSnapshot): { cardio: number; metabolic: number; sleep: number; activity: number } | null {
  const pct = (value: number | null | undefined, min: number, max: number) => {
    if (value === null || value === undefined) return null
    const clamped = Math.max(min, Math.min(max, value))
    return Math.round(((clamped - min) / (max - min)) * 100)
  }

  const cardio = pct(metrics.heartRate, 50, 110)
  const metabolic = pct(metrics.glucose, 70, 160)
  const activity = pct(metrics.steps, 2000, 12000)
  const oxygen = pct(metrics.oxygen, 90, 100)

  if (cardio === null && metabolic === null && activity === null && oxygen === null) return null

  const safe = (value: number | null) => (value === null ? 50 : value)
  const sleep = Math.round((safe(oxygen) * 0.4 + safe(cardio) * 0.3 + safe(metabolic) * 0.3))

  return {
    cardio: cardio ?? 50,
    metabolic: metabolic ?? 50,
    activity: activity ?? 50,
    sleep,
  }
}

function buildAlertsFromMetrics(metrics: MetricSnapshot): AlertCard[] {
  const alerts: AlertCard[] = []

  const push = (status: Status, title: string, detail: string) => {
    if (status === "Stable") return
    const severity: AlertCard["severity"] = status === "Attention" ? "high" : "medium"
    const icon = status === "Attention" ? AlertTriangle : Bell
    alerts.push({ title, detail, severity, icon })
  }

  if (metrics.heartRate !== undefined) {
    const status = deriveHeartRateStatus(metrics.heartRate)
    push(status, "Heart rate", `Today: ${metrics.heartRate} bpm (goal 60-90).`)
  }

  if (metrics.systolic !== undefined && metrics.diastolic !== undefined) {
    const status = deriveBloodPressureStatus(metrics.systolic, metrics.diastolic)
    push(status, "Blood pressure", `Today: ${metrics.systolic}/${metrics.diastolic} mmHg (goal 90-130 / 60-85).`)
  }

  if (metrics.glucose !== undefined) {
    const status = deriveGlucoseStatus(metrics.glucose)
    push(status, "Glucose", `Today: ${metrics.glucose} mg/dL (goal 80-140).`)
  }

  if (metrics.oxygen !== undefined) {
    const status = deriveOxygenStatus(metrics.oxygen)
    push(status, "Oxygen", `Today: ${metrics.oxygen}% (goal 96-100%).`)
  }

  if (metrics.steps !== undefined) {
    const status = deriveStepsStatus(metrics.steps)
    push(status, "Activity", `Today: ${metrics.steps.toLocaleString()} steps (goal 7,500+).`)
  }

  return alerts
}
type StreakCard = { title: string; current: number; longest: number; goal: number; color: string; accent: string }
type Recommendation = { title: string; detail: string }
type AlertCard = { title: string; detail: string; severity: "low" | "medium" | "high" | "critical"; icon: typeof AlertTriangle }

export default function HomePage() {
  const [metrics, setMetrics] = useState<MetricSnapshot>({})
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [streaks, setStreaks] = useState<StreakCard[]>([])
  const [streakCompletionDates, setStreakCompletionDates] = useState<Date[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [alerts, setAlerts] = useState<AlertCard[]>([])
  const [stability, setStability] = useState<{ cardio: number; metabolic: number; sleep: number; activity: number } | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const storedPatientId = typeof window !== "undefined" ? Number(window.localStorage.getItem("patientId") || "") : undefined

        // Prefer the logged-in patient's profile (requires auth token). Fall back to storedPatientId.
        let effectivePatientId: number | undefined = undefined
        let fetchedProfile = false
        try {
          const profile = await getPatientProfile()
          if (profile && typeof profile.id === "number") {
            fetchedProfile = true
            effectivePatientId = profile.id
            // populate BMI from profile
            if (profile.bmi !== undefined && profile.bmi !== null) {
              setMetrics((prev) => ({ ...prev, bmi: Number(profile.bmi) }))
            } else if (profile.height && profile.weight) {
              const h = Number(profile.height)
              const w = Number(profile.weight)
              if (Number.isFinite(h) && Number.isFinite(w) && h > 0) {
                const heightMeters = h > 3 ? h / 100 : h
                const calc = w / (heightMeters * heightMeters)
                if (Number.isFinite(calc)) setMetrics((prev) => ({ ...prev, bmi: calc }))
              }
            }
          }
        } catch (err) {
          // ignore - will fallback to storedPatientId
        }

        if (!effectivePatientId && storedPatientId) {
          effectivePatientId = storedPatientId
        }

        const rowsPromise = listReadings({ limit: 120, patientId: effectivePatientId })
        const statsPromise = effectivePatientId ? getReadingStats(effectivePatientId, 30) : Promise.resolve([] as ReadingStat[])
        const streakPromise = effectivePatientId ? getReadingStreaks(effectivePatientId) : Promise.resolve(null)
        const recsPromise = getAIRecommendations(7).catch(() => [])
        const alertsPromise = listAlerts().catch(() => [])

        const [rows, stats, streakData, recs, alertData] = await Promise.all([
          rowsPromise,
          statsPromise,
          streakPromise,
          recsPromise,
          alertsPromise,
        ])
        if (cancelled) return
        const today = new Date()
        const todaysRows = rows.filter((r) => isToday(r.recorded_at, today))
        const latest = buildLatestMetrics(rows)
        const todayLatest: MetricSnapshot = todaysRows.length ? buildLatestMetrics(todaysRows) : {}
        const mergedMetrics = mergeMetrics(latest, todayLatest)

        setMetrics((prev) => ({
          ...mergedMetrics,
          bmi: prev.bmi ?? mergedMetrics.bmi ?? null,
          calories: prev.calories ?? mergedMetrics.calories ?? null,
        }))

        // If we didn't fetch an authenticated profile, try the public BMI endpoint
        // (no auth) to display BMI from the patients table as a fallback.
        if (!fetchedProfile && storedPatientId) {
          try {
            const pub = await getPatientPublic(storedPatientId)
            if (pub && typeof pub.bmi === "number") {
              setMetrics((prev) => ({ ...prev, bmi: pub.bmi }))
            }
          } catch (err) {
            // ignore public fetch errors
          }
        }

        if (streakData) {
          setStreaks([
            {
              title: "Reading streak",
              current: streakData.current_streak,
              longest: streakData.longest_streak,
              goal: Math.max(7, streakData.longest_streak),
              color: "text-emerald-400",
              accent: "emerald",
            },
          ])
          setStreakCompletionDates((streakData.dates || []).map((d) => new Date(d)))
        }

        setRecommendations(
          (recs || []).map((r) => ({
            title: r.metric || "Recommendation",
            detail: r.text,
          }))
        )

        // Prefer API alerts (already scoped to today by backend) and fall back to derived when none
        const backendAlerts = (alertData || []).slice(0, 5).map((a) => {
          const rawDetail = a.message || a.metric_type || "Alert"
          const detail = rawDetail
            .replace(/\s*\[device [^\]]+\]\s*$/i, "")
            .replace(/\s*\(device [^\)]+\)\s*$/i, "")

          return {
            title: a.metric_type ? a.metric_type.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "Alert",
            detail,
            severity: (a.severity as AlertCard["severity"]) || "medium",
            icon: a.severity === "high" || a.severity === "critical" ? AlertTriangle : Bell,
          }
        })

        const derivedAlerts = todaysRows.length ? buildAlertsFromMetrics(todayLatest) : []

        if (backendAlerts.length) {
          setAlerts(backendAlerts)
        } else if (derivedAlerts.length) {
          setAlerts(derivedAlerts)
        } else {
          setAlerts(defaultAlerts)
        }

        const stabilityFromToday = todaysRows.length ? buildStabilityFromMetrics(todayLatest) : null
        setStability(stabilityFromToday ?? buildStability(stats))
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load readings")
          setMetrics({})
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Health overview
          </p>
          <Badge variant="outline" className="border-primary/50 bg-primary/10 text-primary">
            {metrics.lastSync ? `Updated ${new Date(metrics.lastSync).toLocaleString()}` : loading ? "Loading" : "Awaiting data"}
          </Badge>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Health Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              Clinical snapshot with adherence and vital trends. Calm, review-friendly view.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5 self-end"
            onClick={() => navigate("/health-data")}
          >
            Show All Health Data <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {buildSnapshotMetrics(metrics).map((metric) => (
          <Card key={metric.title} className="shadow-xs border-border/70 bg-gradient-to-b from-background to-muted/40">
            <CardHeader className="flex flex-col gap-3">
              <div className="flex w-full items-start gap-3">
                <div className="flex items-center gap-3 flex-1">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <metric.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm text-muted-foreground">
                      {metric.title}
                    </CardTitle>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-semibold tracking-tight">
                        {metric.value}
                      </span>
                      {metric.unit && <span className="text-muted-foreground text-sm">{metric.unit}</span>}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className={`${statusTone(metric.status)} ml-auto self-start`}>
                  {metric.status}
                </Badge>
              </div>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card className="shadow-xs">
          <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Streaks</CardTitle>
              <CardDescription>Adherence signals kept subtle and professional.</CardDescription>
            </div>
            {/* <Badge variant="secondary" className="text-xs">Quiet nudges only</Badge> */}
          </CardHeader>
          <CardContent className="pt-2 sm:pt-3">
            <div className="grid gap-4 sm:gap-5 xl:grid-cols-[2fr_1fr]">
              <div className="grid w-full gap-3 sm:gap-4">
                {(streaks.length ? streaks : defaultStreaks).map((streak) => {
                  const progress = Math.min(100, Math.round((streak.current / streak.goal) * 100))
                  return (
                    <Card key={streak.title} size="sm" className="border-border/70 shadow-xs">
                      <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4 lg:gap-5">
                        <div className="shrink-0">
                          <CircularProgress value={progress} className={streak.color} />
                        </div>
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium leading-none">{streak.title}</p>
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Longest {streak.longest}d
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <span className="text-foreground font-semibold">{streak.current} days</span>
                            <span>Goal {streak.goal}d</span>
                          </div>
                          <Progress value={progress} className="bg-muted" />
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              <div className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-4">
                <Calendar
                  mode="multiple"
                  selected={streakCompletionDates.length ? streakCompletionDates : defaultCompletionDates}
                  defaultMonth={(streakCompletionDates.length ? streakCompletionDates : defaultCompletionDates)[0]}
                  className="rounded-lg border border-border/60 bg-card text-sm sm:text-base"
                  modifiersClassNames={{
                    selected: "bg-primary/15 text-primary font-semibold rounded-full border border-primary/30",
                  }}
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-2.5 w-2.5 rounded-full border border-primary/30 bg-primary/60" />
                  <span>Completed days</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-primary/20 bg-gradient-to-b from-primary/5 to-background">
          <CardHeader className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>AI Health Insights</CardTitle>
                <CardDescription>Personalized, calm, and actionable.</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">Beta</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {(recommendations.length ? recommendations : defaultRecommendations).map((rec) => (
              <div key={rec.title} className="rounded-lg border border-border/70 bg-card/40 p-3">
                <div className="flex items-start gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <div className="space-y-1">
                    <p className="font-medium leading-tight">{rec.title}</p>
                    <p className="text-muted-foreground text-sm">{rec.detail}</p>
                  </div>
                </div>
              </div>
            ))}
            <p className="text-muted-foreground text-xs">
              For educational purposes only. Not medical advice.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-xs lg:col-span-2">
          <CardHeader>
            <CardTitle>Alerts</CardTitle>
            <CardDescription>Recent clinical alerts with severity coding.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(alerts.length ? alerts : defaultAlerts).map((alert) => (
              <div
                key={alert.title}
                className="flex items-start gap-3 rounded-lg border border-border/70 bg-card/50 p-3"
              >
                <div className={alertTone(alert.severity)}>
                  <alert.icon className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium leading-tight">{alert.title}</p>
                    <Badge variant="outline" className={alertBadge(alert.severity)}>
                      {alert.severity === "critical"
                        ? "Critical"
                        : alert.severity === "high"
                          ? "High"
                          : alert.severity === "medium"
                            ? "Moderate"
                            : "Info"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">{alert.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle>Stability overview</CardTitle>
            <CardDescription>Quick pulse on risk areas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RiskRow label="Cardio load" value={stability?.cardio ?? 78} />
            <RiskRow label="Metabolic" value={stability?.metabolic ?? 64} />
            <RiskRow label="Sleep hygiene" value={stability?.sleep ?? 58} />
            <RiskRow label="Activity balance" value={stability?.activity ?? 72} />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function CircularProgress({ value, className }: { value: number; className?: string }) {
  const radius = 32
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, value))
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="relative inline-flex">
      <svg viewBox="0 0 80 80" className="h-16 w-16">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth={10}
          stroke="currentColor"
          className="text-muted-foreground/20"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          stroke="currentColor"
          className={className ?? "text-primary"}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-foreground">
        {Math.round(clamped)}%
      </div>
    </div>
  )
}

function RiskRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}%</span>
      </div>
      <Progress value={value} className="bg-muted" />
    </div>
  )
}

function statusTone(status: Status) {
  if (status === "Stable") return "border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
  if (status === "Monitor") return "border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
  return "border-red-300/70 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
}

function alertTone(severity: "high" | "medium" | "low" | "critical") {
  if (severity === "critical") return "flex h-9 w-9 items-center justify-center rounded-lg bg-red-600/15 text-red-700"
  if (severity === "high") return "flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-600"
  if (severity === "medium") return "flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"
  return "flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"
}

function alertBadge(severity: "high" | "medium" | "low" | "critical") {
  if (severity === "critical") return "border-red-600/50 bg-red-600/15 text-red-700"
  if (severity === "high") return "border-red-500/40 bg-red-500/10 text-red-600"
  if (severity === "medium") return "border-amber-500/40 bg-amber-500/10 text-amber-600"
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
}
