import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { ThemeProvider } from "@/components/theme-provider"

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")

  return {
    ...actual,
    // Auth flows
    checkEmailExists: vi.fn(async () => ({ exists: true })),
    requestPasswordReset: vi.fn(async () => ({ ok: true })),
    verifyOTP: vi.fn(async () => ({ ok: true })),
    resetPassword: vi.fn(async () => ({ ok: true })),

    // Patient profile + readings
    getPatientProfile: vi.fn(async () => ({
      id: 1,
      email: "patient@example.com",
      first_name: "Test",
      last_name: "Patient",
      height: 170,
      weight: 70,
      bmi: 24.2,
    })),
    getPatientPublic: vi.fn(async () => ({ id: 1, bmi: 24.2 })),
    getPatientDetail: vi.fn(async (id: number) => ({
      id,
      email: "patient@example.com",
      first_name: "Test",
      last_name: "Patient",
      bmi: 24.2,
      risk_level: "low",
    })),
    listReadings: vi.fn(async () => []),
    getReadingStats: vi.fn(async () => []),
    getReadingStreaks: vi.fn(async () => ({ current_streak: 0, longest_streak: 0, dates: [] })),

    // Dashboard / alerts / assistant
    listAlerts: vi.fn(async () => []),
    getAIRecommendations: vi.fn(async () => []),
    aiChat: vi.fn(async () => ({ answer: "Mock answer", summary: null, risk_flags: [] })),

    // Goals / thresholds / notifications
    listGoals: vi.fn(async () => []),
    listThresholds: vi.fn(async () => []),
    createGoal: vi.fn(async () => ({ id: 1, metric_type: "steps", target_value: 9000, created_at: new Date().toISOString() })),
    updateGoal: vi.fn(async () => ({ id: 1, metric_type: "steps", target_value: 9000, created_at: new Date().toISOString() })),
    createThreshold: vi.fn(async () => ({ id: 1, metric_type: "heart_rate", condition: "lt", value: 55, is_active: true })),
    updateThreshold: vi.fn(async () => ({ id: 1, metric_type: "heart_rate", condition: "lt", value: 55, is_active: true })),
    listPatientAccessRequests: vi.fn(async () => []),
    respondPatientAccessRequest: vi.fn(async () => ({ ok: true })),

    // Settings
    updatePatientProfile: vi.fn(async (payload: Record<string, unknown>) => ({
      id: 1,
      email: "patient@example.com",
      first_name: String(payload.firstName ?? "Test"),
      last_name: String(payload.lastName ?? "Patient"),
      height: payload.height ? Number(payload.height) : 170,
      weight: payload.weight ? Number(payload.weight) : 70,
      bmi: 24.2,
    })),
    checkPatientPassword: vi.fn(async () => ({ valid: true })),
    changePatientPassword: vi.fn(async () => ({ ok: true })),
    getPatientLoginAttempts: vi.fn(async () => []),

    // Admin + doctor
    listStaff: vi.fn(async () => []),
    createStaff: vi.fn(async () => ({ id: 1 })),
    updateStaff: vi.fn(async () => ({ id: 1 })),
    deactivateStaff: vi.fn(async () => ({ ok: true })),
    listAllPatients: vi.fn(async () => []),
    listDoctorPatients: vi.fn(async () => []),
    requestDoctorPatient: vi.fn(async () => ({ ok: true })),
    cancelDoctorPatientRequest: vi.fn(async () => ({ ok: true })),
    removeDoctorPatient: vi.fn(async () => ({ ok: true })),
  }
})

import Login from "@/login/login"
import Signup from "@/login/signup"
import PersonalInfo from "@/login/personal-info"
import ForgotPassword from "@/login/forgot-password"
import VerifyOTP from "@/login/verify-otp"
import ResetPassword from "@/login/reset-password"
import HomePage from "@/features/patient/pages/home"
import DevicesPage from "@/features/patient/pages/devices"
import ReportsPage from "@/features/patient/pages/reports"
import YourDataPage from "@/features/patient/pages/your-data"
import SettingsPage from "@/features/patient/pages/settings"
import GoalsLimitsPage from "@/features/patient/pages/goals-limits"
import AiAssistantPage from "@/features/patient/pages/ai-assistant"
import NotificationsPage from "@/features/patient/pages/notifications"
import LogoutPage from "@/features/patient/pages/logout"
import HealthDataPage from "@/features/patient/pages/health-data"
import AdminHomePage from "@/features/admin/AdminHomePage"
import DoctorHomePage from "@/features/doctor/DoctorHomePage"
import DoctorNotificationsPage from "@/features/doctor/DoctorNotificationsPage"
import PatientDetailPage from "@/features/doctor/PatientDetailPage"
import PatientDataPage from "@/features/doctor/PatientDataPage"
import PatientReportsPage from "@/features/doctor/PatientReportsPage"

type Entry = string | { pathname: string; state?: unknown }

type RouteCase = {
  name: string
  path: string
  entry?: Entry
  element: ReactElement
  expected: RegExp | string
  assertAs?: "heading" | "text"
}

function renderRoute(routeCase: RouteCase) {
  const entry = routeCase.entry ?? routeCase.path
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path={routeCase.path} element={routeCase.element} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  )
}

beforeEach(() => {
  window.localStorage.setItem("accessToken", "test-token")
  window.localStorage.setItem("patientId", "1")
  window.localStorage.setItem("staffId", "1")
  window.sessionStorage.setItem(
    "signupDraft",
    JSON.stringify({
      firstName: "Test",
      lastName: "Patient",
      email: "patient@example.com",
      password: "Password1*",
    })
  )

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => [],
      text: async () => "",
    }))
  )
})

describe("All routed pages", () => {
  const routeCases: RouteCase[] = [
    { name: "login page", path: "/login", element: <Login />, expected: /Login to your account/i, assertAs: "heading" },
    { name: "signup page", path: "/signup", element: <Signup />, expected: /Create your account/i, assertAs: "heading" },
    { name: "personal info page", path: "/signup/personal-info", element: <PersonalInfo />, expected: /Personal info/i, assertAs: "heading" },
    { name: "forgot password page", path: "/forgot-password", element: <ForgotPassword />, expected: /Forgot Password/i, assertAs: "heading" },
    {
      name: "verify otp page",
      path: "/forgot-password/verify",
      entry: { pathname: "/forgot-password/verify", state: { email: "patient@example.com" } },
      element: <VerifyOTP />,
      expected: /Verify Code/i,
      assertAs: "heading",
    },
    {
      name: "reset password page",
      path: "/forgot-password/reset",
      entry: {
        pathname: "/forgot-password/reset",
        state: { email: "patient@example.com", otp: "123456" },
      },
      element: <ResetPassword />,
      expected: /Reset Password/i,
      assertAs: "heading",
    },
    { name: "home page", path: "/", element: <HomePage />, expected: /Health Dashboard/i, assertAs: "heading" },
    { name: "devices page", path: "/devices", element: <DevicesPage />, expected: /Devices/i, assertAs: "heading" },
    { name: "reports page", path: "/reports", element: <ReportsPage />, expected: /Reports/i, assertAs: "heading" },
    { name: "your data page", path: "/your-data", element: <YourDataPage />, expected: /Your Data/i, assertAs: "heading" },
    { name: "settings page", path: "/settings", element: <SettingsPage />, expected: /Settings/i, assertAs: "heading" },
    { name: "goals page", path: "/goals-limits", element: <GoalsLimitsPage />, expected: /Goals\s*&\s*Limits/i, assertAs: "heading" },
    { name: "ai assistant page", path: "/ai-assistant", element: <AiAssistantPage />, expected: /AI Assistant/i, assertAs: "heading" },
    { name: "notifications page", path: "/notifications", element: <NotificationsPage />, expected: /Notifications/i, assertAs: "heading" },
    { name: "logout page", path: "/logout", element: <LogoutPage />, expected: /Logout/i, assertAs: "heading" },
    { name: "health data page", path: "/health-data", element: <HealthDataPage />, expected: /All Health Data/i, assertAs: "heading" },
    { name: "admin home page", path: "/admin", element: <AdminHomePage />, expected: /Staff\s*&\s*doctors/i, assertAs: "heading" },
    { name: "doctor home page", path: "/doctor", element: <DoctorHomePage />, expected: /Patients/i, assertAs: "heading" },
    {
      name: "doctor notifications page",
      path: "/doctor/notifications",
      element: <DoctorNotificationsPage />,
      expected: /Requests/i,
      assertAs: "heading",
    },
    {
      name: "doctor patient detail page",
      path: "/doctor/patients/:id",
      entry: "/doctor/patients/1",
      element: <PatientDetailPage />,
      expected: /Key metrics/i,
      assertAs: "text",
    },
    {
      name: "doctor patient data page",
      path: "/doctor/patients/:id/data",
      entry: "/doctor/patients/1/data",
      element: <PatientDataPage />,
      expected: /Patient Data/i,
      assertAs: "heading",
    },
    {
      name: "doctor patient reports page",
      path: "/doctor/patients/:id/reports",
      entry: "/doctor/patients/1/reports",
      element: <PatientReportsPage />,
      expected: /Patient Reports/i,
      assertAs: "heading",
    },
  ]

  it.each(routeCases)("renders $name", async (routeCase) => {
    renderRoute(routeCase)
    if (routeCase.assertAs === "heading") {
      expect(
        await screen.findByRole("heading", { name: routeCase.expected })
      ).toBeInTheDocument()
      return
    }

    expect(await screen.findByText(routeCase.expected)).toBeInTheDocument()
  })
})
