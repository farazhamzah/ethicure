import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  createGoal,
  createThreshold,
  listGoals,
  listThresholds,
  updateGoal,
  updateThreshold,
} from "@/lib/api"

type GoalsState = {
  dailySteps: number
}

type ThresholdState = {
  heartRateLow: number
  heartRateHigh: number
  glucoseLow: number
  glucoseHigh: number
  spo2Low: number
}

type ThresholdIds = {
  heartRateLow?: number
  heartRateHigh?: number
  glucoseLow?: number
  glucoseHigh?: number
  spo2Low?: number
}

const INITIAL_GOALS: GoalsState = {
  dailySteps: 9000,
}

const INITIAL_THRESHOLDS: ThresholdState = {
  heartRateLow: 55,
  heartRateHigh: 110,
  glucoseLow: 70,
  glucoseHigh: 160,
  spo2Low: 92,
}

const GOAL_LIMITS = {
  dailySteps: { min: 1000, max: 50000 },
} as const

const THRESHOLD_LIMITS = {
  heartRateLow: { min: 30, max: 220 },
  heartRateHigh: { min: 30, max: 220 },
  glucoseLow: { min: 50, max: 400 },
  glucoseHigh: { min: 50, max: 400 },
  spo2Low: { min: 80, max: 100 },
} as const

export default function GoalsLimitsPage() {
  const [goals, setGoals] = React.useState<GoalsState>(INITIAL_GOALS)
  const [thresholds, setThresholds] = React.useState<ThresholdState>(INITIAL_THRESHOLDS)
  const [todayGoalId, setTodayGoalId] = React.useState<number | null>(null)
  const [todayThresholdIds, setTodayThresholdIds] = React.useState<ThresholdIds>({})
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null)

  React.useEffect(() => {
    let active = true

    const loadGoalsAndThresholds = async () => {
      setError(null)
      try {
        const [goalData, thresholdData] = await Promise.all([
          listGoals(),
          listThresholds(),
        ])
        if (!active) return

        const sortedGoals = [...goalData].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        const now = new Date()
        const todayIso = new Date().toISOString().slice(0, 10)

        const isSameCalendarDay = (raw: string) => {
          const dt = new Date(raw)
          return (
            dt.getFullYear() === now.getFullYear() &&
            dt.getMonth() === now.getMonth() &&
            dt.getDate() === now.getDate()
          )
        }

        const todayStepsGoal = sortedGoals.find(
          (goal) => goal.metric_type === "steps" && goal.start_date === todayIso,
        )
        setTodayGoalId(todayStepsGoal?.id ?? null)

        const stepsGoal =
          sortedGoals.find((goal) => goal.metric_type === "steps" && goal.is_active) ||
          sortedGoals.find((goal) => goal.metric_type === "steps")

        if (stepsGoal) {
          setGoals({
            dailySteps: Number(stepsGoal.target_value) || INITIAL_GOALS.dailySteps,
          })
          setLastSaved(new Date(stepsGoal.created_at))
        }

        const toNumber = (value: number | string | null | undefined, fallback: number) => {
          if (value === null || value === undefined) return fallback
          const num = Number(value)
          return Number.isNaN(num) ? fallback : num
        }

        const nextThresholds: ThresholdState = { ...INITIAL_THRESHOLDS }

        const sortedThresholds = [...thresholdData].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )

        const todayIds: ThresholdIds = {
          heartRateLow: sortedThresholds.find(
            (t) => t.metric_type === "heart_rate" && t.condition === "below" && isSameCalendarDay(t.created_at),
          )?.id,
          heartRateHigh: sortedThresholds.find(
            (t) => t.metric_type === "heart_rate" && t.condition === "above" && isSameCalendarDay(t.created_at),
          )?.id,
          glucoseLow: sortedThresholds.find(
            (t) => t.metric_type === "glucose" && t.condition === "below" && isSameCalendarDay(t.created_at),
          )?.id,
          glucoseHigh: sortedThresholds.find(
            (t) => t.metric_type === "glucose" && t.condition === "above" && isSameCalendarDay(t.created_at),
          )?.id,
          spo2Low: sortedThresholds.find(
            (t) => t.metric_type === "oxygen" && t.condition === "below" && isSameCalendarDay(t.created_at),
          )?.id,
        }
        setTodayThresholdIds(todayIds)

        const findLatest = (metric: string, condition: string) =>
          sortedThresholds.find(
            (t) => t.metric_type === metric && t.condition === condition && t.is_active,
          ) ||
          sortedThresholds.find(
            (t) => t.metric_type === metric && t.condition === condition,
          )

        const heartLow = findLatest("heart_rate", "below")
        if (heartLow) {
          nextThresholds.heartRateLow = toNumber(heartLow.value, INITIAL_THRESHOLDS.heartRateLow)
        }
        const heartHigh = findLatest("heart_rate", "above")
        if (heartHigh) {
          nextThresholds.heartRateHigh = toNumber(heartHigh.value, INITIAL_THRESHOLDS.heartRateHigh)
        }

        const glucoseLow = findLatest("glucose", "below")
        if (glucoseLow) {
          nextThresholds.glucoseLow = toNumber(glucoseLow.value, INITIAL_THRESHOLDS.glucoseLow)
        }
        const glucoseHigh = findLatest("glucose", "above")
        if (glucoseHigh) {
          nextThresholds.glucoseHigh = toNumber(glucoseHigh.value, INITIAL_THRESHOLDS.glucoseHigh)
        }

        const spo2Low = findLatest("oxygen", "below")
        if (spo2Low) {
          nextThresholds.spo2Low = toNumber(spo2Low.value, INITIAL_THRESHOLDS.spo2Low)
        }

        setThresholds(nextThresholds)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : "Unable to load goals or thresholds.")
      } finally {
        if (active) setLoading(false)
      }
    }

    loadGoalsAndThresholds()
    return () => {
      active = false
    }
  }, [])

  const handleGoalChange = (key: keyof GoalsState, value: string) => {
    const numericValue = Number(value)
    setGoals((prev) => ({ ...prev, [key]: Number.isNaN(numericValue) ? prev[key] : numericValue }))
  }

  const handleThresholdChange = (key: keyof ThresholdState, value: string) => {
    const numericValue = Number(value)
    setThresholds((prev) => ({ ...prev, [key]: Number.isNaN(numericValue) ? prev[key] : numericValue }))
  }

  const validateBeforeSave = () => {
    if (
      goals.dailySteps < GOAL_LIMITS.dailySteps.min ||
      goals.dailySteps > GOAL_LIMITS.dailySteps.max
    ) {
      return `Daily steps goal must be between ${GOAL_LIMITS.dailySteps.min} and ${GOAL_LIMITS.dailySteps.max}.`
    }

    const thresholdEntries: Array<[keyof ThresholdState, string]> = [
      ["heartRateLow", "Heart rate low"],
      ["heartRateHigh", "Heart rate high"],
      ["glucoseLow", "Glucose low"],
      ["glucoseHigh", "Glucose high"],
      ["spo2Low", "SpO2 minimum"],
    ]

    for (const [key, label] of thresholdEntries) {
      const value = thresholds[key]
      const limits = THRESHOLD_LIMITS[key]
      if (value < limits.min || value > limits.max) {
        return `${label} must be between ${limits.min} and ${limits.max}.`
      }
    }

    if (thresholds.heartRateLow >= thresholds.heartRateHigh) {
      return "Heart rate low must be lower than heart rate high."
    }

    if (thresholds.glucoseLow >= thresholds.glucoseHigh) {
      return "Glucose low must be lower than glucose high."
    }

    return null
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const validationError = validateBeforeSave()
      if (validationError) {
        setError(validationError)
        return
      }

      const todayIso = new Date().toISOString().slice(0, 10)

      const payload = {
        metricType: "steps" as const,
        targetValue: goals.dailySteps,
        startDate: todayIso,
        isActive: true,
      }

      let sameDayGoalId = todayGoalId

      if (!sameDayGoalId) {
        const refreshedGoals = await listGoals()
        sameDayGoalId = [...refreshedGoals]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .find((goal) => goal.metric_type === "steps" && goal.start_date === todayIso)?.id ?? null
      }

      const saved = sameDayGoalId
        ? await updateGoal(sameDayGoalId, { targetValue: goals.dailySteps, isActive: true })
        : await createGoal(payload)

      setTodayGoalId(saved.id)
      setLastSaved(new Date())

      let refreshedThresholds: Awaited<ReturnType<typeof listThresholds>> | null = null
      const now = new Date()
      const isSameCalendarDay = (raw: string) => {
        const dt = new Date(raw)
        return (
          dt.getFullYear() === now.getFullYear() &&
          dt.getMonth() === now.getMonth() &&
          dt.getDate() === now.getDate()
        )
      }

      const findSameDayThresholdId = async (
        existingId: number | undefined,
        metricType: "heart_rate" | "glucose" | "oxygen",
        condition: "above" | "below",
      ) => {
        if (existingId) return existingId
        if (!refreshedThresholds) refreshedThresholds = await listThresholds()

        return [...refreshedThresholds]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .find(
            (t) =>
              t.metric_type === metricType &&
              t.condition === condition &&
              isSameCalendarDay(t.created_at),
          )?.id
      }

      const upsertThreshold = async (
        key: keyof ThresholdIds,
        metricType: "heart_rate" | "glucose" | "oxygen",
        condition: "above" | "below",
        value: number,
      ) => {
        const sameDayId = await findSameDayThresholdId(todayThresholdIds[key], metricType, condition)
        const result = sameDayId
          ? await updateThreshold(sameDayId, { value, isActive: true })
          : await createThreshold({ metricType, condition, value, isActive: true })

        setTodayThresholdIds((prev) => ({ ...prev, [key]: result.id }))
        return result
      }

      const thresholdPromises: Array<Promise<unknown>> = []

      thresholdPromises.push(
        upsertThreshold("heartRateLow", "heart_rate", "below", thresholds.heartRateLow),
      )
      thresholdPromises.push(
        upsertThreshold("heartRateHigh", "heart_rate", "above", thresholds.heartRateHigh),
      )
      thresholdPromises.push(
        upsertThreshold("glucoseLow", "glucose", "below", thresholds.glucoseLow),
      )
      thresholdPromises.push(
        upsertThreshold("glucoseHigh", "glucose", "above", thresholds.glucoseHigh),
      )
      thresholdPromises.push(
        upsertThreshold("spo2Low", "oxygen", "below", thresholds.spo2Low),
      )

      await Promise.all(thresholdPromises)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save goal.")
    } finally {
      setSaving(false)
    }
  }

  const lastSavedLabel = React.useMemo(() => {
    if (!lastSaved) return "Not saved yet"
    return lastSaved.toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    })
  }, [lastSaved])

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Targets
        </p>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Goals &amp; Limits</h1>
          <p className="text-sm text-muted-foreground">
            Set your daily movement goal and the safety thresholds you want alerts for.
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Goals</CardTitle>
            <CardDescription>Steps you want to achieve consistently.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading your goals...</p>
            ) : null}
            <Field orientation="responsive">
              <FieldLabel>Daily steps goal</FieldLabel>
              <FieldContent>
                <Input
                  type="number"
                  inputMode="numeric"
                  disabled={loading || saving}
                  value={goals.dailySteps}
                  onChange={(event) => handleGoalChange("dailySteps", event.target.value)}
                  min={GOAL_LIMITS.dailySteps.min}
                  max={GOAL_LIMITS.dailySteps.max}
                  step={100}
                />
                <FieldDescription>Typical guidance: 8k–12k steps per day.</FieldDescription>
              </FieldContent>
            </Field>
          </CardContent>
          <CardFooter className="justify-between">
            <p className="text-sm text-muted-foreground">Last saved: {lastSavedLabel}</p>
            <Button type="submit" disabled={loading || saving}>
              {saving ? "Saving..." : "Save goals"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thresholds</CardTitle>
            <CardDescription>Upper and lower bounds for alerts and automations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Field orientation="responsive">
                <FieldLabel>Heart rate (low / high)</FieldLabel>
                <FieldContent className="grid gap-3 sm:grid-cols-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    disabled={loading || saving}
                    value={thresholds.heartRateLow}
                    onChange={(event) => handleThresholdChange("heartRateLow", event.target.value)}
                    min={THRESHOLD_LIMITS.heartRateLow.min}
                    max={THRESHOLD_LIMITS.heartRateLow.max}
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    disabled={loading || saving}
                    value={thresholds.heartRateHigh}
                    onChange={(event) => handleThresholdChange("heartRateHigh", event.target.value)}
                    min={THRESHOLD_LIMITS.heartRateHigh.min}
                    max={THRESHOLD_LIMITS.heartRateHigh.max}
                  />
                  <FieldDescription className="sm:col-span-2">
                    Recommended: keep resting below 110 bpm.
                  </FieldDescription>
                </FieldContent>
              </Field>

              <Field orientation="responsive">
                <FieldLabel>Glucose (low / high)</FieldLabel>
                <FieldContent className="grid gap-3 sm:grid-cols-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    disabled={loading || saving}
                    value={thresholds.glucoseLow}
                    onChange={(event) => handleThresholdChange("glucoseLow", event.target.value)}
                    min={THRESHOLD_LIMITS.glucoseLow.min}
                    max={THRESHOLD_LIMITS.glucoseLow.max}
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    disabled={loading || saving}
                    value={thresholds.glucoseHigh}
                    onChange={(event) => handleThresholdChange("glucoseHigh", event.target.value)}
                    min={THRESHOLD_LIMITS.glucoseHigh.min}
                    max={THRESHOLD_LIMITS.glucoseHigh.max}
                  />
                  <FieldDescription className="sm:col-span-2">
                    Post-meal alerts often trigger above 160 mg/dL.
                  </FieldDescription>
                </FieldContent>
              </Field>

              <Field orientation="responsive">
                <FieldLabel>SpO₂ minimum</FieldLabel>
                <FieldContent className="max-w-sm">
                  <Input
                    type="number"
                    inputMode="numeric"
                    disabled={loading || saving}
                    value={thresholds.spo2Low}
                    onChange={(event) => handleThresholdChange("spo2Low", event.target.value)}
                    min={THRESHOLD_LIMITS.spo2Low.min}
                    max={THRESHOLD_LIMITS.spo2Low.max}
                    step={0.5}
                  />
                  <FieldDescription>Alert if saturation drops below this value.</FieldDescription>
                </FieldContent>
              </Field>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <p className="text-sm text-muted-foreground">Last saved: {lastSavedLabel}</p>
            <Button type="submit" variant="outline">
              Save thresholds
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
