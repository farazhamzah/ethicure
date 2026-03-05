import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { format, parseISO, parse, isValid as isValidDate } from "date-fns"

import { login, registerPatient } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const genderOptions = [
  { label: "Female", value: "female" },
  { label: "Male", value: "male" },
  { label: "Other", value: "other" },
]

const DRAFT_KEY = "signupDraft"

type Draft = {
  firstName: string
  lastName: string
  email: string
  password: string
}

export function PersonalInfoForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [form, setForm] = useState({
    gender: "female",
    height: "",
    weight: "",
  })
  const [dob, setDob] = useState<Date | undefined>(undefined)
  const [dobInput, setDobInput] = useState("")
  const [dobError, setDobError] = useState<string | null>(null)

  const draft: Draft | null = useMemo(() => {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      if (
        typeof parsed.firstName === "string" &&
        typeof parsed.lastName === "string" &&
        typeof parsed.email === "string" &&
        typeof parsed.password === "string"
      ) {
        return parsed as Draft
      }
    } catch (err) {
      return null
    }
    return null
  }, [])

  useEffect(() => {
    if (!draft) {
      navigate("/signup", { replace: true })
    }
  }, [draft, navigate])

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const parseDob = (raw: string): Date | undefined => {
    const value = raw.trim()
    if (!value) return undefined

    const normalized = value.replaceAll("/", "-")

    // Prefer day-first formats per requirement
    const tryFormats = [
      "dd-MM-yyyy",
      "dd/MM/yyyy",
      "yyyy-MM-dd",
      "yyyy/MM/dd",
      "MM-dd-yyyy",
      "MM/dd/yyyy",
    ]

    for (const fmt of tryFormats) {
      const parsed = fmt.includes("/")
        ? parse(value, fmt, new Date())
        : parse(normalized, fmt, new Date())
      if (isValidDate(parsed)) return parsed
    }

    // Fallback to ISO parsing after normalization
    const iso = parseISO(normalized)
    if (isValidDate(iso)) return iso
    return undefined
  }

  const handleDobInputCommit = () => {
    if (!dobInput.trim()) {
      setDob(undefined)
      setDobError(null)
      return
    }

    const parsed = parseDob(dobInput)
    if (parsed) {
      setDob(parsed)
      setDobInput(format(parsed, "dd-MM-yyyy"))
      setDobError(null)
    } else {
      setDob(undefined)
      setDobError("Enter a valid date (DD-MM-YYYY or DD/MM/YYYY)")
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!draft) {
      setError("Please start signup again.")
      navigate("/signup", { replace: true })
      return
    }

    if (!dob) {
      setError("Please choose your date of birth.")
      return
    }

    setLoading(true)

    try {
      const patient = await registerPatient({
        firstName: draft.firstName,
        lastName: draft.lastName,
        email: draft.email,
        password: draft.password,
        gender: form.gender,
        dateOfBirth: format(dob, "yyyy-MM-dd"),
        height: form.height,
        weight: form.weight,
      })

      const identity = patient.username || draft.email

      const result = await login({
        identity,
        password: draft.password,
        userType: "patient",
      })

      localStorage.setItem("accessToken", result.access)
      localStorage.setItem("refreshToken", result.refresh)

      if (result.meta.role) {
        localStorage.setItem("authRole", result.meta.role)
      }
      if (result.meta.patientId) {
        localStorage.setItem("patientId", String(result.meta.patientId))
      }
      if (result.meta.staffId) {
        localStorage.setItem("staffId", String(result.meta.staffId))
      }
      if (result.meta.username) {
        localStorage.setItem("username", result.meta.username)
      }

      sessionStorage.removeItem(DRAFT_KEY)

      setSuccess("Personal info saved! Redirecting to your main page...")
      navigate("/")
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
          <h1 className="text-2xl font-bold">Personal info</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Add details to personalize your Ethicure experience.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="gender">Gender</FieldLabel>
            <Select
              name="gender"
              value={form.gender}
              onValueChange={(value) => handleChange("gender", value ?? form.gender)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {genderOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="dob">Date of birth</FieldLabel>
            <div className="space-y-2">
              <Input
                id="dob"
                name="dateOfBirth"
                placeholder="31-12-1990"
                value={dobInput}
                onChange={(e) => setDobInput(e.target.value)}
                onBlur={handleDobInputCommit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleDobInputCommit()
                  }
                }}
              />
              {dobError ? (
                <p className="text-destructive text-sm" role="alert">
                  {dobError}
                </p>
              ) : null}
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="height">Height (cm)</FieldLabel>
            <Input
              id="height"
              name="height"
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              placeholder="170"
              value={form.height}
              onChange={(e) => handleChange("height", e.target.value)}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="weight">Weight (kg)</FieldLabel>
            <Input
              id="weight"
              name="weight"
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              placeholder="70"
              value={form.weight}
              onChange={(e) => handleChange("weight", e.target.value)}
              required
            />
          </Field>
        </div>

        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="text-emerald-600 text-sm" role="status">
            {success}
          </p>
        ) : null}

        <Field>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Finishing signup..." : "Finish and continue"}
          </Button>
        </Field>

        <Field>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => navigate("/signup")}
          >
            Back
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
