import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function clearAuth() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem("accessToken")
    window.localStorage.removeItem("refreshToken")
    window.localStorage.removeItem("authRole")
    window.localStorage.removeItem("patientId")
    window.localStorage.removeItem("staffId")
    window.localStorage.removeItem("username")
  } catch (err) {
    // ignore
  }
}
