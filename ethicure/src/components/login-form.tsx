import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { login } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const navigate = useNavigate()
  const [identity, setIdentity] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await login({ identity, password })

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

      const destination =
        result.meta.role === "admin"
          ? "/admin"
          : result.meta.role === "doctor"
            ? "/doctor"
            : "/"

      navigate(destination)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed"
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
          <h1 className="text-2xl font-bold">Login to your account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your details to access Ethicure
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="identity">Email or username</FieldLabel>
          <Input
            id="identity"
            name="identity"
            type="text"
            autoComplete="username"
            placeholder="m@example.com"
            value={identity}
            onChange={(event) => setIdentity(event.target.value)}
            required
          />
        </Field>

        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <a
              href="/forgot-password"
              className="text-muted-foreground ml-auto text-sm underline underline-offset-4"
            >
              Forgot password?
            </a>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
            {loading ? "Signing in..." : "Login"}
          </Button>
        </Field>

        <Field>
          <FieldDescription className="text-center">
            Don&apos;t have an account?{" "}
            <a href="/signup" className="underline underline-offset-4">
              Sign up
            </a>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
