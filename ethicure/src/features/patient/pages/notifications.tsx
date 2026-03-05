import { useEffect, useMemo, useState } from "react"
import { IconCheck, IconShieldCheck, IconTargetArrow, IconX } from "@tabler/icons-react"

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  getPatientProfile,
  listGoals,
  listPatientAccessRequests,
  listReadings,
  respondPatientAccessRequest,
  type PatientAccessRequest,
  type ReadingRow,
} from "@/lib/api"

type RequestStatus = "pending" | "approved" | "declined"

type AccessRequest = {
  id: number
  doctorId: number
  doctorName: string
  doctorEmail?: string | null
  requestedAt: string
  requestedAtRaw?: string | null
  status: RequestStatus
}

type Alert = {
  id: number
  title: string
  detail: string
  severity: "high" | "medium" | "low"
  time: string
}

type Target = {
  id: number
  label: string
  current: number | null
  target: number
  unit: string
}

const initialAlerts: Alert[] = [
  {
    id: 1,
    title: "Glucose above limit",
    detail: "Avg glucose was 152 mg/dL over the last 24h (target 140).",
    severity: "high",
    time: "15m ago",
  },
  {
    id: 2,
    title: "Sleep dipped",
    detail: "Sleep efficiency dropped to 78% last night.",
    severity: "medium",
    time: "8h ago",
  },
  {
    id: 3,
    title: "Resting HR steady",
    detail: "Resting heart rate stayed within your normal range.",
    severity: "low",
    time: "1d ago",
  },
]

const DEFAULT_STEPS_TARGET = 10000

export default function NotificationsPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts)
  const [stepsTarget, setStepsTarget] = useState<Target>({
    id: 1,
    label: "Steps",
    current: null,
    target: DEFAULT_STEPS_TARGET,
    unit: "steps",
  })
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === "pending").length,
    [requests]
  )

  const updateRequestStatus = async (req: AccessRequest, status: RequestStatus) => {
    setRequestError(null)
    try {
      const decision = status === "approved" ? "accept" : "reject"
      await respondPatientAccessRequest(req.doctorId, decision)
      setRequests((prev) => prev.map((item) => (item.id === req.id ? { ...item, status } : item)))
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update request."
      setRequestError(message)
    }
  }

  const requestBadge = (status: RequestStatus) => {
    if (status === "approved") return <Badge variant="secondary">Approved</Badge>
    if (status === "declined") return <Badge variant="outline">Declined</Badge>
    return <Badge>Pending</Badge>
  }

  const dismissAlert = (id: number) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  const clearAllAlerts = () => setAlerts([])

  const severityTone: Record<Alert["severity"], string> = {
    high: "border-destructive/60 bg-destructive/10 text-destructive",
    medium: "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-100",
    low: "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100",
  }

  const stepsProgress = useMemo(() => {
    const target = stepsTarget.target || DEFAULT_STEPS_TARGET
    if (!target || target <= 0) return 0
    const current = typeof stepsTarget.current === "number" ? stepsTarget.current : 0
    return Math.min(100, Math.round((current / target) * 100))
  }, [stepsTarget])

  const isToday = (timestamp?: string | null, today = new Date()) => {
    if (!timestamp) return false
    const date = new Date(timestamp)
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    )
  }

  useEffect(() => {
    let cancelled = false

    const loadRequests = async () => {
      setLoadingRequests(true)
      setRequestError(null)
      try {
        const data = await listPatientAccessRequests()
        if (cancelled) return
        const mapped: AccessRequest[] = data.map((item: PatientAccessRequest) => {
          const requestedAtRaw = item.created_at ?? null
          const requestedAt = requestedAtRaw ? new Date(requestedAtRaw).toLocaleString() : ""
          return {
            id: item.id,
            doctorId: item.doctor,
            doctorName: item.doctor_name || "Unknown doctor",
            doctorEmail: item.doctor_email,
            requestedAt,
            requestedAtRaw,
            status: item.status === "accepted" ? "approved" : item.status === "rejected" ? "declined" : "pending",
          }
        })

        const limitedToRecentTwo = mapped
          .sort((a, b) => {
            const left = a.requestedAtRaw ? new Date(a.requestedAtRaw).getTime() : 0
            const right = b.requestedAtRaw ? new Date(b.requestedAtRaw).getTime() : 0
            return right - left
          })
          .slice(0, 2)

        setRequests(limitedToRecentTwo)
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Unable to load access requests."
          setRequestError(message)
          setRequests([])
        }
      } finally {
        if (!cancelled) setLoadingRequests(false)
      }
    }

    const loadSteps = async () => {
      setLoadingTargets(true)
      try {
        let patientId: number | undefined
        try {
          const profile = await getPatientProfile()
          if (profile && typeof profile.id === "number") patientId = profile.id
        } catch (err) {
          // ignore and fall back to stored patient id
        }

        if (!patientId && typeof window !== "undefined") {
          const stored = Number(window.localStorage.getItem("patientId") || "")
          if (Number.isFinite(stored)) patientId = stored
        }

        const [goals, readings] = await Promise.all([
          listGoals({ patientId }).catch(() => []),
          listReadings({ patientId, limit: 90 }).catch(() => [] as ReadingRow[]),
        ])

        if (cancelled) return

        const goal = goals.find((g) => g.metric_type === "steps")
        const targetValue = goal && Number.isFinite(Number(goal.target_value))
          ? Number(goal.target_value)
          : DEFAULT_STEPS_TARGET

        const stepsRows = readings
          .filter((r) => r.metric_type === "steps")
          .sort((a, b) => {
            const left = a.recorded_at ? new Date(a.recorded_at).getTime() : 0
            const right = b.recorded_at ? new Date(b.recorded_at).getTime() : 0
            return right - left
          })

        const today = new Date()
        const todays = stepsRows.find((row) => isToday(row.recorded_at, today))
        const latest = todays ?? stepsRows[0]
        const currentValue = latest && latest.value !== undefined && latest.value !== null
          ? Number(latest.value)
          : null

        setStepsTarget((prev) => ({
          ...prev,
          current: Number.isFinite(currentValue as number) ? (currentValue as number) : null,
          target: targetValue,
        }))
      } finally {
        if (!cancelled) setLoadingTargets(false)
      }
    }

    loadRequests()
    loadSteps()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Alerts</p>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Review access requests from clinicians, health alerts, and how you are doing against targets.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <IconShieldCheck className="text-primary size-5" />
                Access requests
              </CardTitle>
              <CardDescription>Approve or decline who can view your profile.</CardDescription>
            </div>
            <Badge variant={pendingCount ? "default" : "secondary"}>
              {pendingCount ? `${pendingCount} pending` : "No pending"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {requestError ? (
              <div className="text-sm text-red-600">{requestError}</div>
            ) : null}

            {loadingRequests ? (
              <div className="text-sm text-muted-foreground">Loading requests…</div>
            ) : requests.length === 0 ? (
              <div className="text-sm text-muted-foreground">No access requests right now.</div>
            ) : (
              requests.map((req, index) => (
                <div key={req.id} className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <Avatar>
                        <AvatarFallback>{req.doctorName.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium leading-tight">{req.doctorName}</span>
                          {requestBadge(req.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">{req.doctorEmail ?? ""}</p>
                        <p className="text-sm text-muted-foreground">Requested {req.requestedAt}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateRequestStatus(req, "declined")}
                        disabled={req.status !== "pending"}
                      >
                        <IconX className="mr-1.5 size-4" />
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateRequestStatus(req, "approved")}
                        disabled={req.status !== "pending"}
                      >
                        <IconCheck className="mr-1.5 size-4" />
                        Approve
                      </Button>
                    </div>
                  </div>
                  {index < requests.length - 1 && <Separator />}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Alerts</CardTitle>
              <Button variant="outline" size="sm" onClick={clearAllAlerts} disabled={alerts.length === 0}>
                Clear all
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                You are all caught up. No alerts to review.
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`relative space-y-2 overflow-hidden rounded-xl border p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] ${severityTone[alert.severity]}`}
                >
                  <span className="absolute left-0 top-0 h-full w-1 bg-current opacity-80" aria-hidden />
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="px-2 text-xs capitalize">
                          {alert.severity}
                        </Badge>
                        <span className="font-medium leading-tight">{alert.title}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{alert.detail}</p>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="leading-5">{alert.time}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => dismissAlert(alert.id)}
                        aria-label="Clear alert"
                      >
                        <IconX className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <IconTargetArrow className="text-primary size-5" />
              Targets
            </CardTitle>
            <CardDescription>How you are tracking toward your daily goals.</CardDescription>
          </div>
          <Badge variant="outline" className="self-center text-xs">
            {loadingTargets ? "Loading" : "Today"}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 rounded-xl border bg-card/60 p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{stepsTarget.label}</span>
              <IconTargetArrow className="size-4 text-primary" />
            </div>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-semibold leading-none">
                  {typeof stepsTarget.current === "number" ? stepsTarget.current.toLocaleString() : "—"}
                <span className="text-sm font-normal text-muted-foreground"> {stepsTarget.unit}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                  Target {stepsTarget.target.toLocaleString()} {stepsTarget.unit}
              </span>
            </div>
            <Progress value={stepsProgress} />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <IconShieldCheck className="size-4" />
              {stepsProgress >= 100 ? "Target met" : `${stepsProgress}% of target`}
            </div>
          </div>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Adjust goals in Settings to change your daily targets.
        </CardFooter>
      </Card>
    </div>
  )
}
