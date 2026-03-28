import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom"

import Login from "./login/login"
import Signup from "./login/signup"
import PersonalInfo from "./login/personal-info"
import ForgotPassword from "./login/forgot-password"
import VerifyOTP from "./login/verify-otp"
import ResetPassword from "./login/reset-password"
import DevicesPage from "@/features/patient/pages/devices"
import ReportsPage from "@/features/patient/pages/reports"
import SettingsPage from "@/features/patient/pages/settings"
import YourDataPage from "@/features/patient/pages/your-data"
import HomePage from "@/features/patient/pages/home"
import GoalsLimitsPage from "@/features/patient/pages/goals-limits"
import AiAssistantPage from "@/features/patient/pages/ai-assistant"
import NotificationsPage from "@/features/patient/pages/notifications"
import LogoutPage from "@/features/patient/pages/logout"
import HealthDataPage from "@/features/patient/pages/health-data"
import AdminHomePage from "@/features/admin/AdminHomePage"
import DoctorHomePage from "@/features/doctor/DoctorHomePage"
import PatientDetailPage from "@/features/doctor/PatientDetailPage"
import DoctorNotificationsPage from "@/features/doctor/DoctorNotificationsPage"
import PatientDataPage from "@/features/doctor/PatientDataPage"
import PatientReportsPage from "@/features/doctor/PatientReportsPage"
import DoctorPatientWorkspaceLayout from "@/features/doctor/DoctorPatientWorkspaceLayout"

import AppLayout from "./layouts/AppLayout"
import AdminLayout from "./layouts/AdminLayout"
import DoctorLayout from "./layouts/DoctorLayout"

function RequireAuth() {
  const access = typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null
  if (!access) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes (no sidebar) */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/signup/personal-info" element={<PersonalInfo />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/forgot-password/verify" element={<VerifyOTP />} />
        <Route path="/forgot-password/reset" element={<ResetPassword />} />

        {/* Protected / app routes (with main sidebar) */}
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/your-data" element={<YourDataPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/goals-limits" element={<GoalsLimitsPage />} />
          <Route path="/ai-assistant" element={<AiAssistantPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/logout" element={<LogoutPage />} />
          <Route path="/health-data" element={<HealthDataPage />} />
          </Route>
        </Route>

        {/* Admin routes (with admin sidebar) */}
        <Route element={<RequireAuth />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminHomePage />} />
          </Route>
        </Route>

        {/* Doctor routes (with doctor sidebar) */}
        <Route element={<RequireAuth />}>
          <Route element={<DoctorLayout />}>
            <Route path="/doctor" element={<DoctorHomePage />} />
            <Route path="/doctor/patients/:id" element={<DoctorPatientWorkspaceLayout />}>
              <Route index element={<PatientDetailPage />} />
              <Route path="data" element={<PatientDataPage />} />
              <Route path="reports" element={<PatientReportsPage />} />
            </Route>
            <Route path="/doctor/notifications" element={<DoctorNotificationsPage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
