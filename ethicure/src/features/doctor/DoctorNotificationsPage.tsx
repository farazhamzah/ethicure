import { useEffect, useMemo, useState } from "react"
import { IconBell, IconCheck, IconClock, IconList /* IconUsers */ } from "@tabler/icons-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { listDoctorPatients, type DoctorPatient } from "@/lib/api"

// Extend DoctorPatient with optional request timestamps that may be returned by the API
// and keep rendering resilient if fields are missing.
type RequestRow = DoctorPatient & {
  request_created_at?: string | null
  request_updated_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export default function DoctorNotificationsPage() {
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const staffId = typeof window !== "undefined" ? window.localStorage.getItem("staffId") : null
  const staffIdValue = staffId ? `${staffId}` : null

  useEffect(() => {
    let cancelled = false

    const handleNewRequest = (event: Event) => {
      const detail = (event as CustomEvent<RequestRow>).detail
      if (!detail) return
      setRequests((prev) => {
        const merged = prev.some((p) => p.id === detail.id)
          ? prev.map((p) => (p.id === detail.id ? { ...p, ...detail } : p))
          : [...prev, detail]
        return merged
      })
    }

    const handleCancelRequest = (event: Event) => {
      const detail = (event as CustomEvent<RequestRow>).detail
      if (!detail) return
      setRequests((prev) => prev.filter((p) => p.id !== detail.id))
    }

    window.addEventListener("doctor:request-created", handleNewRequest as EventListener)
    window.addEventListener("doctor:request-cancelled", handleCancelRequest as EventListener)

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await listDoctorPatients()
        if (cancelled) return
        setRequests(Array.isArray(data) ? (data as RequestRow[]) : [])
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Unable to load requests."
          setError(message)
          setRequests([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      window.removeEventListener("doctor:request-created", handleNewRequest as EventListener)
      window.removeEventListener("doctor:request-cancelled", handleCancelRequest as EventListener)
    }
  }, [])

  const rowDoctor = (row: RequestRow) => row.request_doctor_id ?? row.doctor

  const belongsToDoctor = (row: RequestRow) => {
    if (!staffIdValue) return true
    return `${rowDoctor(row) ?? ""}` === staffIdValue
  }

  const requestStatusBadge = (status?: RequestRow["request_status"]) => {
    if (status === "accepted") return <Badge variant="secondary">Approved</Badge>
    if (status === "rejected") return <Badge variant="outline">Declined</Badge>
    return <Badge>Pending</Badge>
  }

  const requestDate = (row: RequestRow) => row.request_created_at || row.created_at
  const approvalDate = (row: RequestRow) => row.request_updated_at || row.updated_at || row.request_created_at

  const sortByRecent = (items: RequestRow[]) =>
    [...items].sort((a, b) => {
      const left = timestampMs(a)
      const right = timestampMs(b)
      return right - left
    })

  const timestampMs = (row: RequestRow) => {
    const raw = row.request_updated_at || row.request_created_at || row.updated_at || row.created_at
    if (!raw) return 0
    const value = new Date(raw).getTime()
    return Number.isFinite(value) ? value : 0
  }

  const formatDate = (value?: string | null) => {
    if (!value) return "—"
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString()
  }

  const pendingRequests = useMemo(
    () =>
      requests.filter((r) => {
        const status = r.request_status || "pending"
        return status === "pending" && belongsToDoctor(r)
      }),
    [requests, staffIdValue]
  )

  const approvedRequests = useMemo(
    () =>
      requests.filter((r) => {
        const status = r.request_status
        return status === "accepted" && belongsToDoctor(r)
      }),
    [requests, staffIdValue]
  )

  const initials = (first?: string | null, last?: string | null) => {
    const left = (first || "").trim()[0] || ""
    const right = (last || "").trim()[0] || ""
    return `${left}${right}`.toUpperCase() || "PT"
  }

  const pending = sortByRecent(pendingRequests)
  const approved = sortByRecent(approvedRequests)

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Notifications</p>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Requests</h1>
          <p className="text-sm text-muted-foreground">
            Review the requests you have sent to patients and see which have been approved recently.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <IconList className="size-5 text-primary" />
                Requests you sent
              </CardTitle>
              <CardDescription>Pending approval from patients.</CardDescription>
            </div>
            <Badge variant={pending.length ? "default" : "secondary"}>
              {pending.length ? `${pending.length} pending` : "No pending"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            {loading ? (
              <div className="text-sm text-muted-foreground">Loading requests…</div>
            ) : pending.length === 0 ? (
              <div className="text-sm text-muted-foreground">No pending requests.</div>
            ) : (
              pending.map((req, index) => (
                <div key={req.id} className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <Avatar>
                        <AvatarFallback>{initials(req.first_name, req.last_name)}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium leading-tight">{`${req.first_name} ${req.last_name}`.trim() || "Patient"}</span>
                          {requestStatusBadge(req.request_status)}
                        </div>
                        <p className="text-sm text-muted-foreground">ID {req.id}</p>
                        <p className="text-sm text-muted-foreground">{req.email}</p>
                        <p className="text-sm text-muted-foreground">Requested {formatDate(requestDate(req))}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <IconClock className="size-4" />
                      {req.request_status === "accepted"
                        ? "Approved"
                        : req.request_status === "rejected"
                          ? "Declined"
                          : "Waiting for patient approval"}
                    </div>
                  </div>
                  {index < pending.length - 1 && <Separator />}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <IconBell className="size-5 text-primary" />
                Recently approved
              </CardTitle>
              <Badge variant={approved.length ? "default" : "secondary"}>
                {approved.length ? `${approved.length} approved` : "None"}
              </Badge>
            </div>
            <CardDescription>Patients who accepted your access requests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading approvals…</div>
            ) : approved.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                No approved requests yet.
              </div>
            ) : (
              approved.map((req) => (
                <div
                  key={`approved-${req.id}`}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <Avatar>
                      <AvatarFallback>{initials(req.first_name, req.last_name)}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium leading-tight">{`${req.first_name} ${req.last_name}`.trim() || "Patient"}</span>
                        <Badge variant="secondary" className="gap-1">
                          <IconCheck className="size-4" /> Approved
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">ID {req.id}</p>
                      <p className="text-sm text-muted-foreground">{req.email}</p>
                      <p className="text-xs text-muted-foreground">Approved {formatDate(approvalDate(req))}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
