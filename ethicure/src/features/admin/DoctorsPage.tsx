import { useMemo, useState, type FormEvent } from "react"
import {
  IconPencil,
  IconPlus,
  IconSearch,
  IconStethoscope,
  IconUserCheck,
  IconUserPlus,
  IconUsers,
  IconTrash,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const specialties = [
  "Cardiology",
  "Endocrinology",
  "General Medicine",
  "Neurology",
  "Oncology",
  "Pediatrics",
  "Psychiatry",
  "Pulmonology",
]

type DoctorStatus = "active" | "onboarding" | "suspended"

type Doctor = {
  id: string
  name: string
  email: string
  specialty: string
  status: DoctorStatus
  patients: number
  phone: string
  location: string
  city: string
  country: string
  createdOn: string
  lastActive: string
}

const defaultDoctors: Doctor[] = [
  {
    id: "DOC-2412",
    name: "Dr. Alicia Hayes",
    email: "alicia.hayes@health.io",
    specialty: "Cardiology",
    status: "active",
    patients: 182,
    phone: "(415) 555-1432",
    location: "SF • Pacific Care",
    city: "San Francisco",
    country: "USA",
    createdOn: "2024-08-14",
    lastActive: "Online now",
  },
  {
    id: "DOC-1844",
    name: "Dr. Marcus Grant",
    email: "marcus.grant@health.io",
    specialty: "Endocrinology",
    status: "active",
    patients: 143,
    phone: "(312) 555-4021",
    location: "Chicago • Lakeside",
    city: "Chicago",
    country: "USA",
    createdOn: "2024-07-02",
    lastActive: "18m ago",
  },
  {
    id: "DOC-1093",
    name: "Dr. Priya Natarajan",
    email: "priya.natarajan@health.io",
    specialty: "Pediatrics",
    status: "onboarding",
    patients: 64,
    phone: "(206) 555-7721",
    location: "Seattle • North Clinic",
    city: "Seattle",
    country: "USA",
    createdOn: "2025-01-10",
    lastActive: "Waiting for EHR link",
  },
  {
    id: "DOC-3188",
    name: "Dr. Jakob Stein",
    email: "jakob.stein@health.io",
    specialty: "Pulmonology",
    status: "suspended",
    patients: 22,
    phone: "(347) 555-2309",
    location: "NYC • Midtown",
    city: "New York",
    country: "USA",
    createdOn: "2023-11-29",
    lastActive: "Access paused",
  },
]

const statusBadge: Record<DoctorStatus, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  onboarding: "border-blue-200 bg-blue-50 text-blue-700",
  suspended: "border-amber-200 bg-amber-50 text-amber-700",
}

const statusLabel: Record<DoctorStatus, string> = {
  active: "Active",
  onboarding: "Onboarding",
  suspended: "Suspended",
}

type FormState = {
  name: string
  email: string
  specialty: string
  status: DoctorStatus
  patients: number
  phone: string
  location: string
}

const emptyForm: FormState = {
  name: "",
  email: "",
  specialty: specialties[0],
  status: "active",
  patients: 0,
  phone: "",
  location: "",
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>(defaultDoctors)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<DoctorStatus | "all">("all")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null)
  const [formState, setFormState] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Doctor | null>(null)

  const filteredDoctors = useMemo(() => {
    return doctors.filter((doctor) => {
      const matchesStatus =
        statusFilter === "all" || doctor.status === statusFilter
      const text = `${doctor.name} ${doctor.email} ${doctor.specialty} ${doctor.location}`.toLowerCase()
      const matchesSearch = text.includes(search.trim().toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [doctors, search, statusFilter])

  const summary = useMemo(
    () => ({
      total: doctors.length,
      active: doctors.filter((d) => d.status === "active").length,
      onboarding: doctors.filter((d) => d.status === "onboarding").length,
    }),
    [doctors]
  )

  const resetForm = () => {
    setFormState(emptyForm)
    setFormError(null)
    setEditingDoctor(null)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.name.trim()) {
      setFormError("Name is required.")
      return
    }
    if (!formState.email.trim()) {
      setFormError("Email is required.")
      return
    }

    const payload: FormState = {
      ...formState,
      name: formState.name.trim(),
      email: formState.email.trim(),
      location: formState.location.trim(),
      phone: formState.phone.trim(),
    }

    const city = payload.location.split("•")[0]?.trim() || "Unknown"
    const country = "USA"

    if (editingDoctor) {
      setDoctors((prev) =>
        prev.map((doctor) =>
          doctor.id === editingDoctor.id
            ? {
                ...doctor,
                ...payload,
                city,
                country,
              }
            : doctor
        )
      )
    } else {
      const newDoctor: Doctor = {
        ...payload,
        id: `DOC-${Math.floor(Math.random() * 9000 + 1000)}`,
        city,
        country,
        createdOn: new Date().toISOString().slice(0, 10),
        lastActive: "Invited just now",
      }
      setDoctors((prev) => [newDoctor, ...prev])
    }

    setIsFormOpen(false)
    resetForm()
  }

  const startCreate = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const startEdit = (doctor: Doctor) => {
    setEditingDoctor(doctor)
    setFormState({
      name: doctor.name,
      email: doctor.email,
      specialty: doctor.specialty,
      status: doctor.status,
      patients: doctor.patients,
      phone: doctor.phone,
      location: doctor.location,
    })
    setFormError(null)
    setIsFormOpen(true)
  }

  const handleDelete = () => {
    if (!pendingDelete) return
    setDoctors((prev) => prev.filter((doctor) => doctor.id !== pendingDelete.id))
    setPendingDelete(null)
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Admin
        </p>
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <IconStethoscope className="h-5 w-5 text-primary" /> Manage doctors
          </h1>
          <p className="text-sm text-muted-foreground">
            Invite, edit, or pause providers. Dummy data only for now.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card className="border border-border/70 bg-card/80">
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Search & Filters</CardTitle>
              <CardDescription>Quickly find doctors and filter by status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Input
                  placeholder="Search name, email, location"
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <IconSearch className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter((value as DoctorStatus | "all") ?? "all")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
                <Button className="w-full gap-1.5" onClick={startCreate} type="button">
                  <IconPlus className="h-4 w-4" /> Add doctor
                </Button>
                <SheetContent side="right" className="sm:max-w-md">
                  <SheetHeader>
                    <SheetTitle>
                      {editingDoctor ? "Edit doctor" : "Add doctor"}
                    </SheetTitle>
                  </SheetHeader>
                  <form className="space-y-4 px-1 py-4" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                      <Label htmlFor="name">Full name</Label>
                      <Input
                        id="name"
                        required
                        value={formState.name}
                        onChange={(event) =>
                          setFormState((prev) => ({ ...prev, name: event.target.value }))
                        }
                        placeholder="Dr. Jane Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={formState.email}
                        onChange={(event) =>
                          setFormState((prev) => ({ ...prev, email: event.target.value }))
                        }
                        placeholder="doctor@clinic.com"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="specialty">Specialty</Label>
                        <Select
                          value={formState.specialty}
                          onValueChange={(value) =>
                            setFormState((prev) => ({ ...prev, specialty: (value as string) || prev.specialty }))
                          }
                        >
                          <SelectTrigger id="specialty">
                            <SelectValue placeholder="Pick one" />
                          </SelectTrigger>
                          <SelectContent>
                            {specialties.map((specialty) => (
                              <SelectItem key={specialty} value={specialty}>
                                {specialty}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={formState.status}
                          onValueChange={(value) =>
                            setFormState((prev) => ({ ...prev, status: value as DoctorStatus }))
                          }
                        >
                          <SelectTrigger id="status">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="onboarding">Onboarding</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="patients">Assigned patients</Label>
                        <Input
                          id="patients"
                          type="number"
                          min={0}
                          value={formState.patients}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              patients: Number(event.target.value) || 0,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          value={formState.phone}
                          onChange={(event) =>
                            setFormState((prev) => ({ ...prev, phone: event.target.value }))
                          }
                          placeholder="(555) 123-4567"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Clinic / location</Label>
                      <Input
                        id="location"
                        value={formState.location}
                        onChange={(event) =>
                          setFormState((prev) => ({ ...prev, location: event.target.value }))
                        }
                        placeholder="City • Clinic name"
                      />
                    </div>
                    {formError && (
                      <p className="text-sm text-destructive">{formError}</p>
                    )}
                    <SheetFooter className="pt-2">
                      <div className="flex w-full justify-end gap-2">
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => {
                            setIsFormOpen(false)
                            resetForm()
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">
                          {editingDoctor ? "Save changes" : "Create doctor"}
                        </Button>
                      </div>
                    </SheetFooter>
                  </form>
                </SheetContent>
              </Sheet>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="group/card flex flex-col gap-4 overflow-hidden rounded-xl border border-border/70 bg-gradient-to-b from-background to-muted/40 py-4 text-sm shadow-xs ring-1 ring-foreground/10 sm:py-5">
              <CardHeader className="flex flex-col gap-3 px-4 pb-1 pt-1 sm:pb-2 sm:pt-1.5">
                <div className="flex w-full items-start gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <IconUsers className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground sm:text-sm">Total</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{summary.total}</span>
                        <span className="text-muted-foreground text-xs sm:text-sm">providers</span>
                      </div>
                      <CardDescription className="text-[11px] sm:text-xs">All providers in the org</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card className="group/card flex flex-col gap-4 overflow-hidden rounded-xl border border-border/70 bg-gradient-to-b from-background to-muted/40 py-4 text-sm shadow-xs ring-1 ring-foreground/10 sm:py-5">
              <CardHeader className="flex flex-col gap-3 px-4 pb-1 pt-1 sm:pb-2 sm:pt-1.5">
                <div className="flex w-full items-start gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <IconUserCheck className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground sm:text-sm">Active</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{summary.active}</span>
                        <span className="text-muted-foreground text-xs sm:text-sm">live</span>
                      </div>
                      <CardDescription className="text-[11px] sm:text-xs">Live and seeing patients</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card className="group/card flex flex-col gap-4 overflow-hidden rounded-xl border border-border/70 bg-gradient-to-b from-background to-muted/40 py-4 text-sm shadow-xs ring-1 ring-foreground/10 sm:py-5">
              <CardHeader className="flex flex-col gap-3 px-4 pb-1 pt-1 sm:pb-2 sm:pt-1.5">
                <div className="flex w-full items-start gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <IconUserPlus className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground sm:text-sm">Onboarding</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{summary.onboarding}</span>
                        <span className="text-muted-foreground text-xs sm:text-sm">in progress</span>
                      </div>
                      <CardDescription className="text-[11px] sm:text-xs">Invited or provisioning</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </section>

      <Card className="shadow-xs border-border/70">
        <CardHeader className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Doctors</CardTitle>
            <CardDescription>Manage providers, specialties, and access.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <Table>
              <TableCaption className="text-left">A list of all doctors in your org.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px] pl-6">Doctor</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Created on</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last active</TableHead>
                  <TableHead className="w-[120px] text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDoctors.map((doctor) => (
                  <TableRow key={doctor.id} className="align-top">
                    <TableCell className="space-y-0.5 pl-6">
                      <div className="font-medium">{doctor.name}</div>
                      <div className="text-xs text-muted-foreground">{doctor.email}</div>
                      <div className="text-xs text-muted-foreground">{doctor.phone}</div>
                    </TableCell>
                    <TableCell>{doctor.city}</TableCell>
                    <TableCell>{doctor.country}</TableCell>
                    <TableCell>{doctor.createdOn}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadge[doctor.status]}>
                        {statusLabel[doctor.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{doctor.lastActive}</TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => startEdit(doctor)}
                          aria-label={`Edit ${doctor.name}`}
                        >
                          <IconPencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setPendingDelete(doctor)}
                          aria-label={`Delete ${doctor.name}`}
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredDoctors.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No doctors match your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
        </div>
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete doctor?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the doctor and their access. Patients stay linked for re-assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
