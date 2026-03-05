import { useEffect, useMemo, useState, type KeyboardEvent } from "react"
import { useNavigate } from "react-router-dom"
import { IconPlus, IconSearch, IconX } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"

import { cancelDoctorPatientRequest, listAllPatients, listDoctorPatients, requestDoctorPatient, type DoctorPatient } from "@/lib/api"

const MAX_ASSIGNED = 5

export default function DoctorHomePage() {
  const navigate = useNavigate()
  const [allPatients, setAllPatients] = useState<DoctorPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const staffId = typeof window !== "undefined" ? window.localStorage.getItem("staffId") : null
  const staffIdValue = staffId ? `${staffId}` : null

  const assignedPatients = useMemo(
    () => allPatients.filter((p) => `${p.doctor ?? ""}` === `${staffIdValue ?? ""}`),
    [allPatients, staffIdValue]
  )
  const pendingPatients = useMemo(
    () => allPatients.filter((p) => p.request_status === "pending"),
    [allPatients]
  )
  const rosterPatients = useMemo(
    () =>
      allPatients.filter((p) => {
        const assignedToMe = `${p.doctor ?? ""}` === `${staffIdValue ?? ""}`
        const requestedByMe = p.request_status === "pending"
        return assignedToMe || requestedByMe
      }),
    [allPatients, staffIdValue]
  )

  const assignedCount = assignedPatients.length
  const rosterFull = assignedCount >= MAX_ASSIGNED
  const pendingRequests = pendingPatients.length

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [directory, roster] = await Promise.all([listAllPatients(), listDoctorPatients()])
        if (!cancelled) {
          if (!staffIdValue) {
            setAllPatients([])
            setError("Missing staff id. Please sign in again.")
            return
          }

          const rosterById = new Map<number, DoctorPatient>()
          roster.forEach((p) => rosterById.set(p.id, p))

          const merged = (Array.isArray(directory) ? directory : []).map((p) => {
            const match = rosterById.get(p.id)
            if (!match) return p
            return {
              ...p,
              doctor: match.doctor ?? p.doctor,
              request_status: match.request_status ?? p.request_status,
            }
          })

          roster.forEach((p) => {
            if (!merged.some((m) => m.id === p.id)) merged.push(p)
          })

          setAllPatients(merged)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Unable to load patients."
          setError(message)
          setAllPatients([])
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

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return allPatients
    return allPatients.filter((patient) => {
      const dob = typeof patient.date_of_birth === "string" ? patient.date_of_birth.toLowerCase() : ""
      const haystack = `${patient.first_name} ${patient.last_name} ${dob}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [allPatients, search])

  const handleNavigate = (patientId: number) => {
    navigate(`/doctor/patients/${patientId}`)
  }

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>, patientId: number) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      handleNavigate(patientId)
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Doctor overview</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Patients</h1>
            <p className="text-muted-foreground text-sm">
              View your assigned patients from the database and jump into their profiles.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setIsSearchOpen(true)}>
              <IconPlus className="mr-2 h-4 w-4" /> Add patient
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm text-muted-foreground">Active roster</CardTitle>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{assignedCount}</span>
              <span className="text-muted-foreground text-sm">of {MAX_ASSIGNED} max</span>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm text-muted-foreground">Pending requests</CardTitle>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{pendingRequests}</span>
              <span className="text-muted-foreground text-sm">awaiting approval</span>
            </div>
          </CardHeader>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Your roster</CardTitle>
            </div>
            <Badge variant="outline" className={rosterFull ? "border-amber-300" : "border-emerald-200"}>
              {rosterFull ? "Roster full" : `${Math.max(0, MAX_ASSIGNED - assignedCount)} slots free`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-red-600">{error}</div>
          ) : null}

          {loading ? (
            <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">Loading patients…</div>
          ) : rosterPatients.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
              No patients assigned yet.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {rosterPatients.map((patient) => (
                <PatientCard
                  key={patient.id}
                  patient={patient}
                  staffIdValue={staffIdValue}
                  rosterFull={rosterFull}
                  onRequest={async () => {}}
                  onNavigate={handleNavigate}
                  onKeyDown={handleCardKeyDown}
                  showPendingBadge
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <AlertDialogContent className="w-[95vw] sm:w-[80vw] lg:w-[60vw] max-w-7xl p-0 overflow-hidden sm:rounded-lg">
          <AlertDialogHeader className="space-y-4 px-4 pt-4 pb-2 sm:px-6 sm:pt-6">
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="pr-10 sm:pr-0">
                <AlertDialogTitle>Search & add patients</AlertDialogTitle>
                <AlertDialogDescription>Search all patients by first name, last name, or DOB.</AlertDialogDescription>
              </div>
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:justify-end">
                <Badge variant="outline" className={rosterFull ? "border-amber-300" : "border-emerald-200"}>
                  {rosterFull ? "Roster full" : `${Math.max(0, MAX_ASSIGNED - assignedCount)} slots free`}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSearchOpen(false)}
                aria-label="Close"
                className="absolute right-0 top-0 sm:static sm:ml-2"
              >
                <IconX className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative w-full md:w-96">
              <Input
                placeholder="Search by name or DOB"
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                autoFocus
              />
              <IconSearch className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </AlertDialogHeader>
          <div className="space-y-4 px-4 pb-4 pt-2 sm:px-6 sm:pb-6 max-h-[70vh] overflow-y-auto">
            {error ? <div className="rounded-md border border-dashed p-4 text-sm text-red-600">{error}</div> : null}

            {loading ? (
              <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">Loading patients…</div>
            ) : searchResults.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
                No patients found{search ? " for that search." : "."}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border bg-background">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">ID</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Age</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Email</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Assigned</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {searchResults.map((patient) => {
                      const assignedToMe = staffIdValue && `${patient.doctor ?? ""}` === staffIdValue
                      const assignedElsewhere = patient.doctor && `${patient.doctor}` !== `${staffIdValue ?? ""}`
                      const requestedByMe = patient.request_status === "pending"
                      const disabled = rosterFull || assignedElsewhere || requestedByMe

                      const handleRequest = async () => {
                        try {
                          setError(null)
                          const updated = await requestDoctorPatient(patient.id)
                          const updatedWithPending = {
                            ...updated,
                            request_status: updated.request_status ?? "pending",
                          }
                          setAllPatients((prev) => {
                            const exists = prev.some((p) => p.id === updated.id)
                            if (exists) return prev.map((p) => (p.id === updated.id ? updatedWithPending : p))
                            return [...prev, updatedWithPending]
                          })

                          // Notify doctor notifications page to display immediately
                          try {
                            window.dispatchEvent(new CustomEvent("doctor:request-created", { detail: updatedWithPending }))
                          } catch (eventError) {
                            console.error("notify doctor request event failed", eventError)
                          }
                        } catch (err) {
                          const message = err instanceof Error ? err.message : "Unable to request patient"
                          setError(message)
                        }
                      }

                      const handleCancel = async () => {
                        try {
                          setError(null)
                          await cancelDoctorPatientRequest(patient.id)
                          const cleared = { ...patient, request_status: null, request_created_at: null, request_updated_at: null }
                          setAllPatients((prev) => prev.map((p) => (p.id === patient.id ? cleared : p)))
                          try {
                            window.dispatchEvent(new CustomEvent("doctor:request-cancelled", { detail: cleared }))
                          } catch (eventError) {
                            console.error("notify doctor request cancel event failed", eventError)
                          }
                        } catch (err) {
                          const message = err instanceof Error ? err.message : "Unable to cancel request"
                          setError(message)
                        }
                      }

                      return (
                        <tr
                          key={patient.id}
                          className="hover:bg-muted/30 cursor-pointer"
                          onClick={() => handleNavigate(patient.id)}
                          onKeyDown={(event) => handleCardKeyDown(event, patient.id)}
                          tabIndex={0}
                        >
                          <td className="px-3 py-2">{patient.id}</td>
                          <td className="px-3 py-2 font-medium">{formatPatientName(patient)}</td>
                          <td className="px-3 py-2">{patient.age ?? "N/A"}</td>
                          <td className="px-3 py-2 break-all text-muted-foreground">{patient.email}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline">
                              {assignedElsewhere
                                ? "Elsewhere"
                                : assignedToMe
                                  ? "Connected"
                                  : requestedByMe
                                    ? "Pending"
                                    : "No"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {requestedByMe ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleCancel()
                                }}
                                className="inline-flex items-center rounded-md border px-3 py-1 text-sm font-medium transition border-destructive text-destructive hover:bg-destructive/10"
                              >
                                Cancel request
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={assignedToMe || disabled}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleRequest()
                                }}
                                className={`inline-flex items-center rounded-md border px-3 py-1 text-sm font-medium transition ${
                                  assignedToMe
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                    : disabled
                                      ? "border-border bg-muted text-muted-foreground cursor-not-allowed"
                                      : "border-primary bg-primary text-primary-foreground hover:opacity-90"
                                }`}
                              >
                                {assignedElsewhere
                                  ? "Assigned elsewhere"
                                  : assignedToMe
                                    ? "Connected"
                                    : rosterFull
                                      ? "Roster full"
                                      : "Request access"}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function formatPatientName(patient: DoctorPatient) {
  return `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim()
}

function formatNumber(value: unknown, unit = "", fractionDigits = 1) {
  if (value === null || value === undefined) return "—"
  const num = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(num)) return "—"
  const rounded = fractionDigits >= 0 ? num.toFixed(fractionDigits) : String(num)
  return unit ? `${rounded} ${unit}` : rounded
}

function MetricChip({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${tone}`}>{value}</div>
    </div>
  )
}

type PatientCardProps = {
  patient: DoctorPatient
  staffIdValue: string | null
  rosterFull: boolean
  onRequest: () => void | Promise<void>
  onNavigate: (id: number) => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>, patientId: number) => void
  disableRequest?: boolean
  assignedElsewhere?: boolean
  showPendingBadge?: boolean
}

function PatientCard({
  patient,
  staffIdValue,
  rosterFull,
  onRequest,
  onNavigate,
  onKeyDown,
  disableRequest,
  assignedElsewhere,
  showPendingBadge,
}: PatientCardProps) {
  const assignedToMe = staffIdValue && `${patient.doctor ?? ""}` === staffIdValue
  const elsewhere = assignedElsewhere ?? (patient.doctor && `${patient.doctor}` !== `${staffIdValue ?? ""}`)
  const requestedByMe = patient.request_status === "pending"
  const requestDisabled = (disableRequest ?? assignedToMe) || rosterFull || elsewhere || requestedByMe

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onNavigate(patient.id)}
      onKeyDown={(event) => onKeyDown(event, patient.id)}
      className="border-muted/60 cursor-pointer transition hover:-translate-y-0.5 hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <CardContent className="p-4 space-y-4">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">ID {patient.id}</div>
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold">{formatPatientName(patient)}</div>
            {showPendingBadge && requestedByMe ? <Badge variant="outline">Pending</Badge> : null}
          </div>
          <div className="text-sm text-muted-foreground">
            {patient.age ? `${patient.age} yrs` : "Age N/A"}
            {patient.gender ? ` • ${patient.gender}` : ""}
          </div>
          <div className="text-sm text-muted-foreground break-all">{patient.email}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <MetricChip label="Height" value={formatNumber(patient.height, "cm")} tone="text-muted-foreground" />
          <MetricChip label="Weight" value={formatNumber(patient.weight, "kg")} tone="text-muted-foreground" />
          <MetricChip label="BMI" value={formatNumber(patient.bmi, "", 1)} tone="text-muted-foreground" />
          <MetricChip
            label="Assigned"
            value={patient.doctor ? "Yes" : requestedByMe ? "Pending" : "No"}
            tone={patient.doctor ? "text-emerald-700" : requestedByMe ? "text-amber-700" : "text-amber-700"}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={requestDisabled}
            onClick={async (event) => {
              event.stopPropagation()
              await onRequest()
            }}
            className={`inline-flex items-center rounded-md border px-3 py-1 text-sm font-medium transition ${
              assignedToMe
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : requestDisabled
                  ? "border-border bg-muted text-muted-foreground cursor-not-allowed"
                  : "border-primary bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            {elsewhere
              ? "Assigned elsewhere"
              : assignedToMe
                ? "Connected"
                : requestedByMe
                  ? "Requested"
                  : rosterFull
                    ? "Roster full"
                    : "Request access"}
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
