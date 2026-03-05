import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { checkEmailExists } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
const DRAFT_KEY = "signupDraft"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailChecking, setEmailChecking] = useState(false)
  const [lastCheckedEmail, setLastCheckedEmail] = useState<string | null>(null)

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

  const verifyEmail = async (opts?: { force?: boolean }) => {
    const force = opts?.force === true
    const email = form.email.trim()
    if (!email) return true

    if (!force && lastCheckedEmail === email && !emailError) return true
    setEmailChecking(true)
    try {
      const result = await checkEmailExists(email)
      if (result.exists) {
        const message = result.inStaff
          ? "This email is already used by a staff account."
          : "A user with this email already exists!"
        setEmailError(message)
        setLastCheckedEmail(email)
        return false
      }
      setEmailError(null)
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

  const handleChange = (
    key: keyof typeof form,
    value: string,
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))

    if (key === "email") {
      // Force a re-check on change without clearing the current message to reduce flicker
      setLastCheckedEmail(null)
    }

    if (key === "confirmPassword") {
      if (form.password && value && form.password !== value) {
        setConfirmError("Passwords do not match")
      } else {
        setConfirmError(null)
      }
    }

    if (key === "password") {
      const newPassword = value
      if (form.confirmPassword && newPassword !== form.confirmPassword) {
        setConfirmError("Passwords do not match")
      } else if (form.confirmPassword) {
        setConfirmError(null)
      }
    }
  }

  useEffect(() => {
    const email = form.email.trim()
    if (!email) {
      setEmailError(null)
      setLastCheckedEmail(null)
      return
    }

    // Only start remote checks when user has typed a few characters to reduce churn
    if (email.length < 3) return

    // Avoid rechecking the same email when already valid and unchanged
    if (email === lastCheckedEmail && !emailError) return

    const timer = setTimeout(() => {
      void verifyEmail({ force: true })
    }, 450)

    return () => clearTimeout(timer)
  }, [form.email, lastCheckedEmail, emailError])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setConfirmError(null)
    setEmailError(null)

    const emailOk = await verifyEmail({ force: true })
    if (!emailOk) return

    if (!passwordValid) {
      setError("Invalid password")
      return
    }

    if (form.password !== form.confirmPassword) {
      setConfirmError("Passwords do not match")
      return
    }

    setLoading(true)

    try {
      const draft = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
      }

      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      navigate("/signup/personal-info")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Signup failed"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Fill in your details to get started with Ethicure.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="first-name">First name</FieldLabel>
            <Input
              id="first-name"
              name="firstName"
              type="text"
              autoComplete="given-name"
              placeholder="Jane"
              value={form.firstName}
              onChange={(e) => handleChange("firstName", e.target.value)}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="last-name">Last name</FieldLabel>
            <Input
              id="last-name"
              name="lastName"
              type="text"
              autoComplete="family-name"
              placeholder="Doe"
              value={form.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
              required
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="m@example.com"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            onBlur={() => {
              if (!emailChecking) {
                verifyEmail()
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                verifyEmail()
              }
            }}
            required
          />
          <FieldDescription>
            We&apos;ll send alerts and notifications to this email.
          </FieldDescription>
          {emailError ? (
            <p className="text-destructive text-sm" role="alert">
              {emailError}
            </p>
          ) : null}
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => handleChange("password", e.target.value)}
            required
          />
          {!passwordValid && form.password ? (
            <div className="text-destructive text-sm space-y-1" role="alert">
              <div className="text-muted-foreground text-sm">Your password must:</div>
              <ul className="list-disc space-y-0.5 pl-4">
                {missingPasswordRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
          ) : (
            <FieldDescription>Strong password.</FieldDescription>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
          <Input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => handleChange("confirmPassword", e.target.value)}
            required
          />
          {confirmError ? (
            <p className="text-destructive text-sm" role="alert">
              {confirmError}
            </p>
          ) : null}
        </Field>

        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <Field>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Continuing..." : "Continue signup"}
          </Button>
        </Field>

        <Field>
          <FieldDescription className="text-center">
            Already have an account? <a href="/login" className="underline underline-offset-4">Sign in</a>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
