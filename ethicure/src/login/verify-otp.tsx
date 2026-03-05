import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { REGEXP_ONLY_DIGITS } from "input-otp"

import runner from "@/assets/runner.png"
import { verifyOTP } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { ThemeToggle } from "@/components/theme-toggle"

export default function VerifyOTPPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || ""

  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Redirect if no email was provided
    if (!email) {
      navigate("/forgot-password")
    }
  }, [email, navigate])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (otp.length !== 6) {
      setError("Please enter a 6-digit code")
      return
    }

    setError(null)
    setLoading(true)

    try {
      await verifyOTP(email, otp)
      // Navigate to reset password page
      navigate("/forgot-password/reset", { state: { email, otp } })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid or expired OTP"
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
            <form
              className={cn("flex flex-col gap-6")}
              onSubmit={handleSubmit}
            >
              <FieldGroup>
                <div className="flex flex-col items-center gap-1 text-center">
                  <h1 className="text-2xl font-bold">Verify Code</h1>
                  <p className="text-muted-foreground text-sm text-balance">
                    Enter the 6-digit code sent to your email
                  </p>
                </div>

                <Field>
                  <FieldLabel htmlFor="otp" className="text-center block">
                    Verification Code
                  </FieldLabel>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={otp}
                      onChange={(value) => setOtp(value)}
                      pattern={REGEXP_ONLY_DIGITS}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <FieldDescription className="text-center text-xs">
                    The code expires in 10 minutes
                  </FieldDescription>
                </Field>

                {error ? (
                  <p className="text-destructive text-sm text-center" role="alert">
                    {error}
                  </p>
                ) : null}

                <Field>
                  <Button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="w-full"
                  >
                    {loading ? "Verifying..." : "Verify Code"}
                  </Button>
                </Field>

                <Field>
                  <FieldDescription className="text-center">
                    Didn&apos;t receive a code?{" "}
                    <a
                      href="/forgot-password"
                      className="underline underline-offset-4"
                    >
                      Resend
                    </a>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
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
