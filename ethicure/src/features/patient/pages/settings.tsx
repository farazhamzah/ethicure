import { useEffect, useMemo, useState } from "react"
import { IconAlertTriangle, IconCheck, IconClock, IconLock, IconRefresh } from "@tabler/icons-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  changePatientPassword,
  checkPatientPassword,
  getPatientLoginAttempts,
  getPatientProfile,
  updatePatientProfile,
  type PatientLoginAttempt,
  type PatientProfile,
} from "@/lib/api"

type ProfileFormState = {
  firstName: string
  lastName: string
  email: string
  height: string
  weight: string
}

const defaultProfile: ProfileFormState = {
  firstName: "",
  lastName: "",
  email: "",
  height: "",
  weight: "",
}

function mapProfileToForm(profile: PatientProfile): ProfileFormState {
  return {
    firstName: profile.first_name ?? "",
    lastName: profile.last_name ?? "",
    email: profile.email ?? "",
    height: profile.height != null ? String(profile.height) : "",
    weight: profile.weight != null ? String(profile.weight) : "",
  }
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileFormState>(defaultProfile)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  const [passwordState, setPasswordState] = useState({
    current: "",
    next: "",
    confirm: "",
  })
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)
  const [currentCheck, setCurrentCheck] = useState<"idle" | "checking" | "valid" | "invalid">("idle")
  const [currentCheckMessage, setCurrentCheckMessage] = useState<string | null>(null)

  const [attempts, setAttempts] = useState<PatientLoginAttempt[]>([])
  const [loadingAttempts, setLoadingAttempts] = useState(false)
  const [attemptsError, setAttemptsError] = useState<string | null>(null)

  useEffect(() => {
    const loadProfile = async () => {
      setLoadingProfile(true)
      setProfileError(null)
      try {
        const data = await getPatientProfile()
        setProfile(mapProfileToForm(data))
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load profile"
        setProfileError(message)
      } finally {
        setLoadingProfile(false)
      }
    }

    const loadAttempts = async () => {
      setLoadingAttempts(true)
      setAttemptsError(null)
      try {
        const data = await getPatientLoginAttempts(3)
        setAttempts(data)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load login attempts"
        setAttemptsError(message)
      } finally {
        setLoadingAttempts(false)
      }
    }

    void loadProfile()
    void loadAttempts()
  }, [])

  const passwordChecks = useMemo(() => ({
    length: passwordState.next.length >= 8,
    upper: /[A-Z]/.test(passwordState.next),
    lower: /[a-z]/.test(passwordState.next),
    number: /\d/.test(passwordState.next),
    special: /[\*\(\)@#?\$]/.test(passwordState.next),
  }), [passwordState.next])

  const passwordValid = useMemo(
    () =>
      passwordChecks.length &&
      passwordChecks.upper &&
      passwordChecks.lower &&
      passwordChecks.number &&
      passwordChecks.special,
    [passwordChecks]
  )

  const missingPasswordRules = useMemo(() => {
    const rules: string[] = []
    if (!passwordChecks.length) rules.push("Have at least 8 characters")
    if (!passwordChecks.upper) rules.push("Contain an upper-case letter")
    if (!passwordChecks.lower) rules.push("Contain a lowercase letter")
    if (!passwordChecks.number) rules.push("Contain a number")
    if (!passwordChecks.special) rules.push("Have one of these special characters : *()@#?$")
    return rules
  }, [passwordChecks])

  // Debounced current-password validation
  useEffect(() => {
    if (!passwordState.current) {
      setCurrentCheck("idle")
      setCurrentCheckMessage(null)
      return
    }

    let cancelled = false
    setCurrentCheck("checking")
    setCurrentCheckMessage(null)

    const timer = setTimeout(() => {
      void checkPatientPassword(passwordState.current)
        .then((valid) => {
          if (cancelled) return
          setCurrentCheck(valid ? "valid" : "invalid")
          setCurrentCheckMessage(valid ? "Current password looks good" : "Current password is incorrect")
        })
        .catch((err) => {
          if (cancelled) return
          setCurrentCheck("invalid")
          const message = err instanceof Error ? err.message : "Unable to verify password"
          setCurrentCheckMessage(message)
        })
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [passwordState.current])

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setProfileError(null)
    setProfileSuccess(null)
    setSavingProfile(true)

    try {
      const updated = await updatePatientProfile({
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        height: profile.height,
        weight: profile.weight,
      })
      setProfile(mapProfileToForm(updated))
      setProfileSuccess("Profile updated")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save profile"
      setProfileError(message)
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    if (!passwordValid) {
      setPasswordError("Password does not meet the requirements.")
      return
    }

    if (passwordState.next !== passwordState.confirm) {
      setPasswordError("Passwords do not match")
      return
    }

    if (!passwordState.current) {
      setPasswordError("Enter your current password")
      return
    }

    if (currentCheck === "invalid") {
      setPasswordError("Current password is incorrect")
      return
    }

    setSavingPassword(true)
    try {
      await changePatientPassword(passwordState.current, passwordState.next)
      setPasswordSuccess("Password updated successfully")
      setPasswordState({ current: "", next: "", confirm: "" })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update password"
      setPasswordError(message)
    } finally {
      setSavingPassword(false)
    }
  }

  const renderAttemptTime = (value: string) => {
    if (!value) return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Account
        </p>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Update your info, change your password, and review recent sign-in activity.
          </p>
        </div>
      </header>

      <Separator />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile & vitals</CardTitle>
              <CardDescription>
                Keep your contact details and body metrics up to date.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingProfile ? (
                <p className="text-sm text-muted-foreground">Loading profile...</p>
              ) : null}
              <form className="space-y-4" onSubmit={handleProfileSave}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First name</Label>
                    <Input
                      id="first-name"
                      value={profile.firstName}
                      autoComplete="given-name"
                      onChange={(e) => setProfile((prev) => ({ ...prev, firstName: e.target.value }))}
                      disabled={loadingProfile || savingProfile}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last name</Label>
                    <Input
                      id="last-name"
                      value={profile.lastName}
                      autoComplete="family-name"
                      onChange={(e) => setProfile((prev) => ({ ...prev, lastName: e.target.value }))}
                      disabled={loadingProfile || savingProfile}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      autoComplete="email"
                      onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))}
                      disabled={loadingProfile || savingProfile}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">Height (cm)</Label>
                    <Input
                      id="height"
                      type="number"
                      value={profile.height}
                      onChange={(e) => setProfile((prev) => ({ ...prev, height: e.target.value }))}
                      disabled={loadingProfile || savingProfile}
                      min={0}
                      step={0.5}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight (kg)</Label>
                    <Input
                      id="weight"
                      type="number"
                      value={profile.weight}
                      onChange={(e) => setProfile((prev) => ({ ...prev, weight: e.target.value }))}
                      disabled={loadingProfile || savingProfile}
                      min={0}
                      step={0.1}
                    />
                  </div>
                </div>

                {profileError ? (
                  <p className="text-destructive text-sm" role="alert">{profileError}</p>
                ) : null}
                {profileSuccess ? (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">{profileSuccess}</p>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <IconLock className="text-primary size-5" />
                <CardTitle>Update password</CardTitle>
              </div>
              <CardDescription>Enter your current password, then set a new one.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handlePasswordSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={passwordState.current}
                    onChange={(e) => setPasswordState((prev) => ({ ...prev, current: e.target.value }))}
                    disabled={savingPassword}
                    required
                  />
                  {currentCheck !== "idle" ? (
                    <p
                      className={`text-xs ${currentCheck === "valid" ? "text-emerald-600 dark:text-emerald-400" : currentCheck === "checking" ? "text-muted-foreground" : "text-destructive"}`}
                    >
                      {currentCheck === "checking" ? "Checking current password..." : currentCheckMessage}
                    </p>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={passwordState.next}
                      onChange={(e) => setPasswordState((prev) => ({ ...prev, next: e.target.value }))}
                      disabled={savingPassword}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm new password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={passwordState.confirm}
                      onChange={(e) => setPasswordState((prev) => ({ ...prev, confirm: e.target.value }))}
                      disabled={savingPassword}
                      required
                    />
                  </div>
                </div>

                {!passwordValid && passwordState.next ? (
                  <div className="text-destructive text-sm space-y-1" role="alert">
                    <div className="text-muted-foreground text-sm">Your password must:</div>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {missingPasswordRules.map((rule) => (
                        <li key={rule}>{rule}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {passwordError ? (
                  <p className="text-destructive text-sm" role="alert">{passwordError}</p>
                ) : null}
                {passwordSuccess ? (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">{passwordSuccess}</p>
                ) : null}

                <div className="flex gap-3">
                  <Button type="submit" disabled={savingPassword}>
                    {savingPassword ? "Updating..." : "Update password"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Login attempts</CardTitle>
              <CardDescription>Recent sign-in activity on your account.</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setLoadingAttempts(true)
                setAttemptsError(null)
                void getPatientLoginAttempts(3)
                  .then(setAttempts)
                  .catch((err) => setAttemptsError(err instanceof Error ? err.message : "Unable to refresh"))
                  .finally(() => setLoadingAttempts(false))
              }}
              aria-label="Refresh login attempts"
            >
              <IconRefresh className="size-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {attemptsError ? (
              <p className="text-destructive text-sm" role="alert">{attemptsError}</p>
            ) : null}

            {loadingAttempts ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : null}

            {!loadingAttempts && attempts.length === 0 ? (
              <div className="text-sm text-muted-foreground">No recent login attempts.</div>
            ) : null}

            <div className="space-y-3">
              {attempts.map((attempt) => (
                <div key={attempt.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <div className={`mt-0.5 rounded-full border ${attempt.success ? "border-emerald-500/60 bg-emerald-500/10" : "border-destructive/60 bg-destructive/10"}`}>
                    {attempt.success ? (
                      <IconCheck className="text-emerald-600 size-4" />
                    ) : (
                      <IconAlertTriangle className="text-destructive size-4" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={attempt.success ? "secondary" : "destructive"}>
                        {attempt.success ? "Success" : "Failed"}
                      </Badge>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <IconClock className="size-4" /> {renderAttemptTime(attempt.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">
                      {attempt.detail || (attempt.success ? "Signed in" : "Sign-in blocked")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {attempt.ip ? `IP: ${attempt.ip}` : "Unknown IP"}
                      {attempt.userAgent ? ` · ${attempt.userAgent}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
