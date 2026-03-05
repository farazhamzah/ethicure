import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

import runner from "@/assets/runner.png"
import { requestPasswordReset, checkEmailExists } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailChecking, setEmailChecking] = useState(false)
  const [lastCheckedEmail, setLastCheckedEmail] = useState<string | null>(null)

  const verifyEmail = async (opts?: { force?: boolean }) => {
    const force = opts?.force === true
    const emailTrimmed = email.trim()
    if (!emailTrimmed) return true

    if (!force && lastCheckedEmail === emailTrimmed && !emailError) return true
    setEmailChecking(true)
    try {
      const result = await checkEmailExists(emailTrimmed)
      if (!result.exists) {
        setEmailError("No account found with this email address")
        setLastCheckedEmail(emailTrimmed)
        return false
      }
      setEmailError(null)
      setLastCheckedEmail(emailTrimmed)
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

  useEffect(() => {
    const emailTrimmed = email.trim()
    if (!emailTrimmed) {
      setEmailError(null)
      setLastCheckedEmail(null)
      return
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailTrimmed)) {
      setEmailError("Please enter a valid email address")
      return
    }

    // Only start remote checks when user has typed a few characters to reduce churn
    if (emailTrimmed.length < 3) return

    // Avoid rechecking the same email when already valid and unchanged
    if (emailTrimmed === lastCheckedEmail && !emailError) return

    const timer = setTimeout(() => {
      void verifyEmail({ force: true })
    }, 450)

    return () => clearTimeout(timer)
  }, [email, lastCheckedEmail, emailError])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLoading(true)

    // Verify email exists first
    const emailOk = await verifyEmail({ force: true })
    if (!emailOk) {
      setLoading(false)
      return
    }

    try {
      await requestPasswordReset(email)
      setSuccess(true)
      
      // Navigate to OTP verification after a brief delay
      setTimeout(() => {
        navigate("/forgot-password/verify", { state: { email } })
      }, 2000)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send OTP"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center md:justify-center">
          <span className="font-semibold text-lg">Ethicure</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            {!success ? (
              <form
                className={cn("flex flex-col gap-6")}
                onSubmit={handleSubmit}
              >
                <FieldGroup>
                  <div className="flex flex-col items-center gap-1 text-center">
                    <h1 className="text-2xl font-bold">Forgot Password</h1>
                    <p className="text-muted-foreground text-sm text-balance">
                      Enter your email to receive a verification code
                    </p>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="m@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                    {emailChecking && (
                      <FieldDescription className="text-xs text-muted-foreground">
                        Checking email...
                      </FieldDescription>
                    )}
                    {emailError && !emailChecking && (
                      <FieldDescription className="text-xs text-destructive">
                        {emailError}
                      </FieldDescription>
                    )}
                    {!emailError && !emailChecking && lastCheckedEmail === email.trim() && email.trim() && (
                      <FieldDescription className="text-xs text-green-600 dark:text-green-500">
                        Email found
                      </FieldDescription>
                    )}
                  </Field>

                  {error ? (
                    <p className="text-destructive text-sm" role="alert">
                      {error}
                    </p>
                  ) : null}

                  <Field>
                    <Button 
                      type="submit" 
                      disabled={loading || emailChecking || !!emailError || !email.trim()} 
                      className="w-full"
                    >
                      {loading ? "Sending..." : "Send Verification Code"}
                    </Button>
                  </Field>

                  <Field>
                    <FieldDescription className="text-center">
                      Remember your password?{" "}
                      <a href="/login" className="underline underline-offset-4">
                        Back to login
                      </a>
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </form>
            ) : (
              <div className="flex flex-col gap-6 text-center">
                <div>
                  <h1 className="text-2xl font-bold mb-2">Check your email</h1>
                  <p className="text-muted-foreground text-sm">
                    We've sent a verification code to <strong>{email}</strong>
                  </p>
                </div>
                <p className="text-muted-foreground text-xs">
                  Redirecting to verification page...
                </p>
              </div>
            )}
            <div className="mt-6 flex justify-center">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <img
          src={runner}
          alt="Image"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.5] dark:grayscale"
        />
      </div>
    </div>
  )
}
