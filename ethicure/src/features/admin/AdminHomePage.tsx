import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  IconPencil,
  IconPlus,
  IconRefresh,
  IconShieldCheck,
  IconStethoscope,
  IconTrash,
} from "@tabler/icons-react"

import { checkEmailExists, createStaff, deactivateStaff, listStaff, updateStaff, type StaffRecord, type StaffRole } from "@/lib/api"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const roleLabel: Record<StaffRole, string> = {
  admin: "Admin",
  doctor: "Doctor",
}

const statusBadge = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  inactive: "border-amber-200 bg-amber-50 text-amber-700",
}

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  role: "doctor" as StaffRole,
  password: "",
  confirmPassword: "",
}

const fallbackStaff: StaffRecord[] = [
  {
    id: 1,
    first_name: "Faraz",
    last_name: "Hamzah",
    email: "fh2046@hw.ac.uk",
    username: "fh2046@hw.ac.uk",
    role: "admin",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    first_name: "Alicia",
    last_name: "Hayes",
    email: "alicia.hayes@health.io",
    username: "alicia.hayes@health.io",
    role: "doctor",
    is_active: true,
    created_at: new Date().toISOString(),
  },
]

function formatName(staff: StaffRecord) {
  const full = `${staff.first_name} ${staff.last_name}`.trim()
  if (staff.role === "doctor" && full) return `Dr. ${full}`
  return full || staff.email
}

function formatDate(value: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

export default function AdminHomePage() {
  const [staff, setStaff] = useState<StaffRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailChecking, setEmailChecking] = useState(false)
  const [lastCheckedEmail, setLastCheckedEmail] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<StaffRole | "all">("all")
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editing, setEditing] = useState<StaffRecord | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [pendingDelete, setPendingDelete] = useState<StaffRecord | null>(null)

  useEffect(() => {
    void loadStaff()
  }, [])

  const filteredStaff = useMemo(() => {
    return staff.filter((member) => {
      const matchesRole = roleFilter === "all" || member.role === roleFilter
      const text = `${member.first_name} ${member.last_name} ${member.email}`.toLowerCase()
      const matchesSearch = text.includes(search.trim().toLowerCase())
      return matchesRole && matchesSearch
    })
  }, [staff, roleFilter, search])

  const summary = useMemo(() => {
    const total = staff.length
    const admins = staff.filter((s) => s.role === "admin").length
    const doctors = staff.filter((s) => s.role === "doctor").length
    const active = staff.filter((s) => s.is_active).length
    return { total, admins, doctors, active }
  }, [staff])

  const passwordChecks = {
    length: form.password.length >= 8,
    upper: /[A-Z]/.test(form.password),
    lower: /[a-z]/.test(form.password),
    number: /\d/.test(form.password),
    special: /[\*\(\)@#?\$]/.test(form.password),
  }

  const passwordValid =
    passwordChecks.length &&
    passwordChecks.upper &&
    passwordChecks.lower &&
    passwordChecks.number &&
    passwordChecks.special

  const missingPasswordRules: string[] = []
  if (!passwordChecks.length) missingPasswordRules.push("Have at least 8 characters")
  if (!passwordChecks.upper) missingPasswordRules.push("Contain an upper-case letter")
  if (!passwordChecks.lower) missingPasswordRules.push("Contain a lowercase letter")
  if (!passwordChecks.number) missingPasswordRules.push("Contain a number")
  if (!passwordChecks.special) missingPasswordRules.push("Have one of these special characters : *()@#?$")

  async function loadStaff() {
    setLoading(true)
    setError(null)
    setWarning(null)
    try {
      const data = await listStaff()
      setStaff(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load staff"
      setWarning(`${message} Showing placeholder data.`)
      setStaff(fallbackStaff)
    } finally {
      setLoading(false)
    }
  }

  function startCreate() {
    setEditing(null)
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        role: "doctor" as StaffRole,
        password: "",
        confirmPassword: "",
      })
    setFormError(null)
    setConfirmError(null)
    setEmailError(null)
    setLastCheckedEmail(null)
    setIsSheetOpen(true)
  }

  function startEdit(member: StaffRecord) {
    setEditing(member)
    setForm({
      firstName: member.first_name,
      lastName: member.last_name,
      email: member.email,
      role: member.role,
      password: "",
      confirmPassword: "",
    })
    setFormError(null)
    setConfirmError(null)
    setEmailError(null)
    setLastCheckedEmail(null)
    setIsSheetOpen(true)
  }

  const handleFieldChange = (key: keyof typeof form, value: string) => {
    if (editing && (key === "firstName" || key === "lastName" || key === "email")) {
      return
    }

    setForm((prev) => ({ ...prev, [key]: value }))

    if (key === "confirmPassword" || key === "password") {
      const nextPassword = key === "password" ? value : form.password
      const nextConfirm = key === "confirmPassword" ? value : form.confirmPassword
      if (nextPassword && nextConfirm && nextPassword !== nextConfirm) {
        setConfirmError("Passwords do not match")
      } else {
        setConfirmError(null)
      }
    }

    if (key === "email") {
      setEmailError(null)
      setLastCheckedEmail(null)
    }
  }

  const verifyEmail = async () => {
    const email = form.email.trim()
    if (!email) return true

    if (lastCheckedEmail === email && !emailError) return true

    const lower = email.toLowerCase()
    const conflict = staff.some((s) => s.email.toLowerCase() === lower && s.id !== editing?.id)
    if (conflict) {
      setEmailError("A user with this email already exists!")
      setLastCheckedEmail(email)
      return false
    }

    setEmailChecking(true)
    setEmailError(null)
    try {
      const result = await checkEmailExists(email)
      if (result.exists) {
        const message = result.inPatients
          ? "This email belongs to a patient account. Choose another."
          : "A user with this email already exists!"
        setEmailError(message)
        setLastCheckedEmail(email)
        return false
      }
      setLastCheckedEmail(email)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to verify email"
      setEmailError(message)
      setLastCheckedEmail(null)
      return false
    } finally {
      setEmailChecking(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setConfirmError(null)
    setEmailError(null)

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setFormError("First name, last name, and email are required")
      return
    }

    if (!editing) {
      const emailOk = await verifyEmail()
      if (!emailOk) return
    }

    const wantsPasswordChange = Boolean(form.password.trim() || form.confirmPassword.trim())

    if (!editing || wantsPasswordChange) {
      if (!passwordValid) {
        setFormError("Invalid password")
        return
      }
      if (form.password.trim() !== form.confirmPassword.trim()) {
        setConfirmError("Passwords do not match")
        return
      }
    }

    setSaving(true)
    try {
      if (editing) {
        const payload: any = {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          isActive: editing.is_active,
        }
        if (wantsPasswordChange) {
          payload.password = form.password
        }
        const updated = await updateStaff(editing.id, payload)
        setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      } else {
        const created = await createStaff({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          role: form.role,
        })
        setStaff((prev) => [created, ...prev])
      }

      setIsSheetOpen(false)
      setEditing(null)
      setForm(emptyForm)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save staff member"
      setFormError(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    if (!pendingDelete) return
    try {
      await deactivateStaff(pendingDelete.id)
      setStaff((prev) => prev.map((s) => (s.id === pendingDelete.id ? { ...s, is_active: false } : s)))
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to deactivate"
      setError(message)
    } finally {
      setPendingDelete(null)
    }
  }

  async function handleReactivate(member: StaffRecord) {
    try {
      const updated = await updateStaff(member.id, { isActive: true })
      setStaff((prev) => prev.map((s) => (s.id === member.id ? updated : s)))
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to reactivate"
      setError(message)
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <header className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Admin overview</p>
            <h1 className="text-2xl font-semibold">Staff & doctors</h1>
            <p className="text-muted-foreground text-sm">Backed by the staff table. Usernames are emails.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="outline" size="sm" onClick={() => void loadStaff()} disabled={loading} className="w-full sm:w-auto">
              <IconRefresh className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button size="sm" onClick={startCreate} className="w-full sm:w-auto">
              <IconPlus className="mr-2 h-4 w-4" /> Add doctor
            </Button>
          </div>
        </div>
        {warning ? (
          <p className="text-amber-600 text-sm" role="status">{warning}</p>
        ) : null}
        {error ? (
          <p className="text-destructive text-sm" role="alert">{error}</p>
        ) : null}
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm text-muted-foreground">Total staff</CardTitle>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{summary.total}</span>
              <Badge variant="outline" className="border-border/70">Records</Badge>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm text-muted-foreground">Admins</CardTitle>
            <div className="flex items-baseline gap-2">
              <IconShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-semibold">{summary.admins}</span>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm text-muted-foreground">Doctors</CardTitle>
            <div className="flex items-baseline gap-2">
              <IconStethoscope className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-semibold">{summary.doctors}</span>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm text-muted-foreground">Active</CardTitle>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold">{summary.active}</span>
              <Badge variant="outline" className={statusBadge.active}>Active</Badge>
            </div>
          </CardHeader>
        </Card>
      </section>

      <Card className="p-0">
        <CardHeader className="flex flex-col gap-3 px-6 pt-6 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Staff table</CardTitle>
            <CardDescription>Pulled directly from the staff DB table.</CardDescription>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Input
                placeholder="Search name or email"
                className="pl-3"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter((value as StaffRole | "all") ?? "all")}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="doctor">Doctor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden sm:block overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden rounded-lg border border-border/70">
                <Table className="min-w-[720px]">
                  <TableHeader className="bg-muted/60">
                    <TableRow>
                      <TableHead className="pl-6">Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-end pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                          Loading staff…
                        </TableCell>
                      </TableRow>
                    ) : filteredStaff.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                          No staff found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStaff.map((member) => (
                        <TableRow key={member.id} className="hover:bg-muted/40">
                          <TableCell className="pl-6 py-3 font-medium">{formatName(member)}</TableCell>
                          <TableCell className="py-3 text-muted-foreground">{member.email}</TableCell>
                          <TableCell className="py-3">
                            <Badge variant="outline">{roleLabel[member.role]}</Badge>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge variant="outline" className={member.is_active ? statusBadge.active : statusBadge.inactive}>
                              {member.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 text-muted-foreground">{formatDate(member.created_at)}</TableCell>
                          <TableCell className="py-3 pr-6 text-end">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => startEdit(member)}>
                                <IconPencil className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                              </Button>
                              {member.is_active ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setPendingDelete(member)}
                                  className="text-destructive"
                                >
                                  <IconTrash className="h-4 w-4" />
                                  <span className="sr-only">Deactivate</span>
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => void handleReactivate(member)}
                                >
                                  <IconShieldCheck className="h-4 w-4" />
                                  <span className="sr-only">Reactivate</span>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3 px-4 pb-4 pt-3">
            {loading ? (
              <div className="text-center text-sm text-muted-foreground py-4">Loading staff…</div>
            ) : filteredStaff.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-4">No staff found.</div>
            ) : (
              filteredStaff.map((member) => (
                <div key={member.id} className="rounded-lg border border-border/70 bg-card p-4 shadow-sm space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium leading-tight">{formatName(member)}</p>
                      <p className="text-sm text-muted-foreground break-all">{member.email}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline">{roleLabel[member.role]}</Badge>
                        <Badge variant="outline" className={member.is_active ? statusBadge.active : statusBadge.inactive}>
                          {member.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Joined {formatDate(member.created_at)}</p>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(member)} aria-label="Edit">
                        <IconPencil className="h-4 w-4" />
                      </Button>
                      {member.is_active ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setPendingDelete(member)}
                          aria-label="Deactivate"
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button size="icon" variant="ghost" onClick={() => void handleReactivate(member)} aria-label="Reactivate">
                          <IconShieldCheck className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit staff" : "Add doctor"}</SheetTitle>
          </SheetHeader>
          <form className="space-y-4 px-4 pb-6" onSubmit={handleSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(event) => handleFieldChange("firstName", event.target.value)}
                  required
                  disabled={!!editing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(event) => handleFieldChange("lastName", event.target.value)}
                  required
                  disabled={!!editing}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => handleFieldChange("email", event.target.value)}
                onBlur={() => {
                  if (!emailChecking) {
                    void verifyEmail()
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void verifyEmail()
                  }
                }}
                required
                disabled={!!editing}
              />
              {emailError ? (
                <p className="text-destructive text-sm" role="alert">
                  {emailError}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                disabled={!!editing}
                onValueChange={(value) => setForm((prev) => ({ ...prev, role: value as StaffRole }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {editing ? (
                <p className="text-xs text-muted-foreground">Role cannot be changed after creation.</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(event) => handleFieldChange("password", event.target.value)}
                placeholder={editing ? "Leave blank to keep current" : "Min 8 characters"}
                required={!editing}
              />
              {editing ? (
                <p className="text-xs text-muted-foreground">Set a new password or leave blank to keep the current one.</p>
              ) : null}
              {!passwordValid && form.password ? (
                <div className="text-destructive text-sm space-y-1" role="alert">
                  <div className="text-muted-foreground text-sm">Your password must:</div>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {missingPasswordRules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={(event) => handleFieldChange("confirmPassword", event.target.value)}
                placeholder="Re-enter password"
                required={!editing}
              />
              {confirmError ? (
                <p className="text-destructive text-sm" role="alert">
                  {confirmError}
                </p>
              ) : null}
            </div>
            {formError ? (
              <p className="text-destructive text-sm" role="alert">
                {formError}
              </p>
            ) : null}
            <SheetFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setIsSheetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editing ? "Save changes" : "Create"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!pendingDelete} onOpenChange={() => setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate staff member</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the staff record as inactive. Patients assigned to this doctor will remain linked until reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeactivate()}>Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
