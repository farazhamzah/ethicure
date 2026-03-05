import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"

import runner from "@/assets/runner.png"
import { resetPassword } from "@/lib/api"
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

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || ""
  const otp = location.state?.otp || ""

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Redirect if no email or OTP was provided
    if (!email || !otp) {
      navigate("/forgot-password")
    }
  }, [email, otp, navigate])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    // Validate password strength
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long")
      return
    }

    if (!/[A-Z]/.test(newPassword)) {
      setError("Password must contain at least one uppercase letter")
      return
    }

    if (!/[a-z]/.test(newPassword)) {
      setError("Password must contain at least one lowercase letter")
      return
    }

    if (!/\d/.test(newPassword)) {
      setError("Password must contain at least one digit")
      return
    }

    if (!/[\*\(\)@#?\$]/.test(newPassword)) {
      setError("Password must contain at least one special character (*()@#?$)")
      return
    }

    setLoading(true)

    try {
      await resetPassword(email, otp, newPassword)
      setSuccess(true)
      
      // Navigate to login after a brief delay
      setTimeout(() => {
        navigate("/login")
      }, 2000)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reset password"
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
                    <h1 className="text-2xl font-bold">Reset Password</h1>
                    <p className="text-muted-foreground text-sm text-balance">
                      Enter your new password
                    </p>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="newPassword">New Password</FieldLabel>
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      required
                    />
                    <FieldDescription className="text-xs">
                      Must be at least 8 characters with uppercase, lowercase, digit, and special character (*()@#?$)
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                    />
                  </Field>

                  {error ? (
                    <p className="text-destructive text-sm" role="alert">
                      {error}
                    </p>
                  ) : null}

                  <Field>
                    <Button type="submit" disabled={loading} className="w-full">
                      {loading ? "Resetting..." : "Reset Password"}
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
                  <h1 className="text-2xl font-bold mb-2">Password Reset Successful!</h1>
                  <p className="text-muted-foreground text-sm">
                    Your password has been reset successfully.
                  </p>
                </div>
                <p className="text-muted-foreground text-xs">
                  Redirecting to login page...
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
