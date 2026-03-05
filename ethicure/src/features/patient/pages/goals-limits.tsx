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

export default function GoalsLimitsPage() {
  const [goals, setGoals] = React.useState<GoalsState>(INITIAL_GOALS)
  const [thresholds, setThresholds] = React.useState<ThresholdState>(INITIAL_THRESHOLDS)
  const [goalId, setGoalId] = React.useState<number | null>(null)
  const [thresholdIds, setThresholdIds] = React.useState<ThresholdIds>({})
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

        const stepsGoal = goalData.find((goal) => goal.metric_type === "steps")
        if (stepsGoal) {
          setGoalId(stepsGoal.id)
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

        const ids: ThresholdIds = {}
        const nextThresholds: ThresholdState = { ...INITIAL_THRESHOLDS }

        const find = (metric: string, condition: string) =>
          thresholdData.find(
            (t) => t.metric_type === metric && t.condition === condition,
          )

        const heartLow = find("heart_rate", "below")
        if (heartLow) {
          ids.heartRateLow = heartLow.id
          nextThresholds.heartRateLow = toNumber(heartLow.value, INITIAL_THRESHOLDS.heartRateLow)
        }
        const heartHigh = find("heart_rate", "above")
        if (heartHigh) {
          ids.heartRateHigh = heartHigh.id
          nextThresholds.heartRateHigh = toNumber(heartHigh.value, INITIAL_THRESHOLDS.heartRateHigh)
        }

        const glucoseLow = find("glucose", "below")
        if (glucoseLow) {
          ids.glucoseLow = glucoseLow.id
          nextThresholds.glucoseLow = toNumber(glucoseLow.value, INITIAL_THRESHOLDS.glucoseLow)
        }
        const glucoseHigh = find("glucose", "above")
        if (glucoseHigh) {
          ids.glucoseHigh = glucoseHigh.id
          nextThresholds.glucoseHigh = toNumber(glucoseHigh.value, INITIAL_THRESHOLDS.glucoseHigh)
        }

        const spo2Low = find("oxygen", "below")
        if (spo2Low) {
          ids.spo2Low = spo2Low.id
          nextThresholds.spo2Low = toNumber(spo2Low.value, INITIAL_THRESHOLDS.spo2Low)
        }

        setThresholdIds(ids)
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const payload = {
        metricType: "steps" as const,
        targetValue: goals.dailySteps,
        startDate: new Date().toISOString().slice(0, 10),
        isActive: true,
      }

      const saved = goalId
        ? await updateGoal(goalId, { targetValue: goals.dailySteps })
        : await createGoal(payload)

      const savedAt = saved?.created_at ? new Date(saved.created_at) : new Date()
      setGoalId(saved.id)
      setLastSaved(savedAt)

      const thresholdPromises: Array<Promise<unknown>> = []

      const upsertThreshold = (
        existingId: number | undefined,
        metricType: "heart_rate" | "glucose" | "oxygen",
        condition: "above" | "below",
        value: number,
      ) => {
        if (existingId) {
          return updateThreshold(existingId, { value })
        }
        return createThreshold({ metricType, condition, value, isActive: true })
      }

      thresholdPromises.push(
        upsertThreshold(thresholdIds.heartRateLow, "heart_rate", "below", thresholds.heartRateLow),
      )
      thresholdPromises.push(
        upsertThreshold(thresholdIds.heartRateHigh, "heart_rate", "above", thresholds.heartRateHigh),
      )
      thresholdPromises.push(
        upsertThreshold(thresholdIds.glucoseLow, "glucose", "below", thresholds.glucoseLow),
      )
      thresholdPromises.push(
        upsertThreshold(thresholdIds.glucoseHigh, "glucose", "above", thresholds.glucoseHigh),
      )
      thresholdPromises.push(
        upsertThreshold(thresholdIds.spo2Low, "oxygen", "below", thresholds.spo2Low),
      )

      const results = await Promise.all(thresholdPromises)

      // Capture ids for new thresholds
      setThresholdIds((prev) => ({
        ...prev,
        heartRateLow: (results[0] as any)?.id ?? prev.heartRateLow,
        heartRateHigh: (results[1] as any)?.id ?? prev.heartRateHigh,
        glucoseLow: (results[2] as any)?.id ?? prev.glucoseLow,
        glucoseHigh: (results[3] as any)?.id ?? prev.glucoseHigh,
        spo2Low: (results[4] as any)?.id ?? prev.spo2Low,
      }))
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
                  min={0}
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
                    min={30}
                    max={200}
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    disabled={loading || saving}
                    value={thresholds.heartRateHigh}
                    onChange={(event) => handleThresholdChange("heartRateHigh", event.target.value)}
                    min={40}
                    max={220}
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
                    min={50}
                    max={300}
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    disabled={loading || saving}
                    value={thresholds.glucoseHigh}
                    onChange={(event) => handleThresholdChange("glucoseHigh", event.target.value)}
                    min={80}
                    max={400}
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
                    min={80}
                    max={100}
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
