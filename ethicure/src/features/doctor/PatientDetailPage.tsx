import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { IconArrowLeft, IconHeartbeat } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatName, PATIENT_DIRECTORY, riskTone } from "@/features/doctor/patients"
import { getPatientDetail, listReadings, removeDoctorPatient, type PatientProfile, type ReadingRow } from "@/lib/api"

type MetricSnapshot = {
  heartRate?: number
  systolic?: number
  diastolic?: number
  glucose?: number
  oxygen?: number
  steps?: number
  bmi?: number | null
  lastSync?: string | null
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
    lastSync: latestTimestamp,
  }
}

function metricsFromMock(mock: (typeof PATIENT_DIRECTORY)[number] | undefined): MetricSnapshot {
  if (!mock) return {}
  return {
    heartRate: mock.metrics.heartRate,
    systolic: mock.metrics.systolic,
    diastolic: mock.metrics.diastolic,
    glucose: mock.metrics.glucose,
    oxygen: mock.metrics.oxygen,
    steps: mock.metrics.steps,
    bmi: mock.metrics.bmi,
    lastSync: mock.lastSync,
  }
}

export default function PatientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [patient, setPatient] = useState<PatientProfile | (typeof PATIENT_DIRECTORY)[number] | null>(null)
  const [metrics, setMetrics] = useState<MetricSnapshot>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const fallbackMock = useMemo(() => PATIENT_DIRECTORY.find((p) => p.id === id), [id])
  const numericId = useMemo(() => (id ? Number(id) : NaN), [id])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!id) {
        setError("No patient id provided")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      // If the route id is not numeric, fall back to mock data for now
      if (Number.isNaN(numericId)) {
        setPatient(fallbackMock ?? null)
        setMetrics(metricsFromMock(fallbackMock))
        setLoading(false)
        return
      }

      try {
        const detail = await getPatientDetail(numericId)
        if (cancelled) return
        setPatient(detail)

        try {
          const readings = await listReadings({ patientId: detail.id, limit: 120 })
          if (!cancelled) {
            const latest = buildLatestMetrics(readings)
            latest.bmi = detail.bmi ?? null
            setMetrics(latest)
          }
        } catch (readErr) {
          if (!cancelled) {
            // Still show patient even if readings fail
            setMetrics({ bmi: detail.bmi ?? null })
            setError(readErr instanceof Error ? readErr.message : "Unable to load readings")
          }
        }
      } catch (err) {
        if (cancelled) return
        if (fallbackMock) {
          setPatient(fallbackMock)
          setMetrics(metricsFromMock(fallbackMock))
        }
        setError(err instanceof Error ? err.message : "Unable to load patient")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [fallbackMock, id, numericId])

  const displayRows = useMemo(() => {
    const toDisplay = metrics || {}
    const safeSteps = toDisplay.steps !== undefined ? toDisplay.steps : undefined
    return [
      { label: "Heart rate", value: toDisplay.heartRate !== undefined ? `${toDisplay.heartRate} bpm` : "—" },
      {
        label: "Blood pressure",
        value:
          toDisplay.systolic !== undefined && toDisplay.diastolic !== undefined
            ? `${toDisplay.systolic}/${toDisplay.diastolic} mmHg`
            : "—",
      },
      { label: "Glucose", value: toDisplay.glucose !== undefined ? `${toDisplay.glucose} mg/dL` : "—" },
      { label: "Oxygen", value: toDisplay.oxygen !== undefined ? `${toDisplay.oxygen}%` : "—" },
      {
        label: "Steps",
        value:
          safeSteps !== undefined
            ? `${Number(safeSteps).toLocaleString()} steps`
            : "—",
      },
      {
        label: "BMI",
        value:
          toDisplay.bmi !== undefined && toDisplay.bmi !== null
            ? Number(toDisplay.bmi).toFixed(1)
            : "—",
      },
    ]
  }, [metrics])

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="inline-flex items-center gap-2">
          <IconArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="p-6 text-muted-foreground">Loading patient…</CardContent>
        </Card>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="space-y-4 p-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="inline-flex items-center gap-2">
          <IconArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="p-6 text-muted-foreground">
            {error || "Patient not found."}
          </CardContent>
        </Card>
      </div>
    )
  }

  const patientName = formatName({
    firstName: (patient as any).firstName,
    lastName: (patient as any).lastName,
    first_name: (patient as any).first_name,
    last_name: (patient as any).last_name,
    email: (patient as any).email,
    username: (patient as any).username,
  })

  const assignedToMe = typeof patient.doctor === "number" && patient.doctor !== null

  const handleRemove = async () => {
    if (!patient || !patient.id) return
    setSaving(true)
    setActionMessage(null)
    setError(null)
    try {
      const updated = await removeDoctorPatient(patient.id)
      setPatient(updated)
      setActionMessage("Patient removed from your roster.")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to remove patient"
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate(-1)} className="inline-flex items-center gap-2">
          <IconArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          {assignedToMe ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemove}
              disabled={saving}
            >
              Remove patient
            </Button>
          ) : null}
          <Badge variant="outline" className={riskTone["moderate"]}>
            Risk TBD
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <div className="text-sm text-muted-foreground">{patient.id}</div>
          <CardTitle className="text-2xl font-semibold">{patientName}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {patient.age ? `${patient.age} yrs` : "Age n/a"} • {patient.gender || "Gender n/a"} • Location n/a
          </p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <IconHeartbeat className="h-4 w-4" />
            Last synced {metrics.lastSync ? new Date(metrics.lastSync).toLocaleString() : "n/a"}
          </div>
          <p>
            Basic demographics are live from the backend. Metrics pull from readings_draft; add more readings for richer detail.
          </p>
          {actionMessage ? <div className="text-xs text-emerald-700">{actionMessage}</div> : null}
          {error ? <div className="text-xs text-destructive">{error}</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key metrics</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell>{row.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}