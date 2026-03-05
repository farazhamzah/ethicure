import { useEffect, useState } from "react"

// Admin is hard-coded to patient with id 7 per requirements.
const ADMIN_PATIENT_ID = "7"

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1]
    const decoded = atob(payload)
    return JSON.parse(decoded)
  } catch (error) {
    return null
  }
}

function getIsAdmin(): boolean {
  if (typeof window === "undefined") return false

  const patientId = window.localStorage.getItem("patientId")
  if (patientId && patientId === ADMIN_PATIENT_ID) return true

  const access = window.localStorage.getItem("accessToken")
  if (access) {
    const payload = decodeJwt(access) || {}
    const pid = (payload as any).patient_id ?? (payload as any).patientId
    if (pid && String(pid) === ADMIN_PATIENT_ID) return true
  }

  return false
}

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(() => getIsAdmin())

  useEffect(() => {
    const sync = () => setIsAdmin(getIsAdmin())
    sync()
    window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [])

  return isAdmin
}
