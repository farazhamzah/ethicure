type UserType = "patient" | "staff"

export interface LoginParams {
  identity: string
  password: string
  /** Optional: force which endpoint to try first; otherwise auto-detect. */
  userType?: UserType
}

export interface LoginResult {
  access: string
  refresh: string
  payload: Record<string, unknown>
  meta: {
    role?: string
    patientId?: number
    staffId?: number
    username?: string
  }
}

export type StaffRole = "admin" | "doctor"

export interface StaffRecord {
  id: number
  first_name: string
  last_name: string
  email: string
  username: string
  role: StaffRole
  is_active: boolean
  created_at: string
}

export interface CreateStaffInput {
  firstName: string
  lastName: string
  email: string
  password: string
  role: StaffRole
}

export interface UpdateStaffInput {
  firstName?: string
  lastName?: string
  email?: string
  role?: StaffRole
  isActive?: boolean
}

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
export const API_BASE_URL = rawBaseUrl.replace(/\/$/, "")

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem("accessToken")
}

function authHeaders(): HeadersInit {
  const access = getAccessToken()
  if (!access) throw new Error("Missing access token. Please sign in again.")
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${access}`,
  }
}

function buildLoginPath(userType: UserType) {
  return userType === "patient" ? "/api/patient/token/" : "/api/token/"
}

export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1]
    const decoded = atob(payload)
    return JSON.parse(decoded)
  } catch (error) {
    return null
  }
}

async function postLogin(url: string, identity: string, password: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: identity, password }),
  })

  const data = await response.json().catch(() => ({}))
  return { response, data }
}

export async function login(params: LoginParams): Promise<LoginResult> {
  const { identity, password, userType } = params

  const order: UserType[] = userType
    ? [userType]
    : (["patient", "staff"] as UserType[])

  let lastError: Error | null = null
  let lastData: any = null

  for (const candidate of order) {
    const url = `${API_BASE_URL}${buildLoginPath(candidate)}`
    const { response, data } = await postLogin(url, identity, password)

    if (response.ok) {
      const access = String(data.access)
      const refresh = String(data.refresh)
      const payload = decodeJwt(access) || {}

      const patientId =
        (payload as any).patient_id ?? (payload as any).patientId ?? data.patient_id
      const staffId = (payload as any).staff_id ?? (payload as any).staffId
      const role = (payload as any).role ?? (candidate === "staff" ? "staff" : "patient")

      return {
        access,
        refresh,
        payload,
        meta: {
          role: typeof role === "string" ? role : undefined,
          patientId: typeof patientId === "number" ? patientId : undefined,
          staffId: typeof staffId === "number" ? staffId : undefined,
          username:
            typeof data.username === "string"
              ? data.username
              : typeof (payload as any).username === "string"
                ? (payload as any).username
                : identity,
        },
      }
    }

    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to sign in. Check your credentials and try again."
    lastError = new Error(message)
    lastData = data

    // If forced userType was provided, do not fallback further
    if (userType) break
  }

  const message =
    (typeof lastData?.detail === "string" && lastData.detail) ||
    (typeof lastData?.error === "string" && lastData.error) ||
    "Unable to sign in. Check your credentials and try again."

  throw lastError ?? new Error(message)
}

// ---------- Staff (admin) ----------

export async function listStaff(): Promise<StaffRecord[]> {
  const response = await fetch(`${API_BASE_URL}/api/staff/`)

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to load staff."
    throw new Error(message)
  }

  return data as StaffRecord[]
}

export async function createStaff(input: CreateStaffInput): Promise<StaffRecord> {
  const payload = {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    email: input.email.trim(),
    username: input.email.trim(),
    password: input.password,
    role: input.role,
  }

  const response = await fetch(`${API_BASE_URL}/api/staff/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to create staff member."
    throw new Error(message)
  }

  return data as StaffRecord
}

export async function updateStaff(id: number, input: UpdateStaffInput): Promise<StaffRecord> {
  const payload: Record<string, unknown> = {}
  if (input.firstName !== undefined) payload.first_name = input.firstName.trim()
  if (input.lastName !== undefined) payload.last_name = input.lastName.trim()
  if (input.email !== undefined) {
    payload.email = input.email.trim()
    payload.username = input.email.trim()
  }
  if (input.role !== undefined) payload.role = input.role
  if (input.isActive !== undefined) payload.is_active = input.isActive

  const response = await fetch(`${API_BASE_URL}/api/staff/${id}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to update staff member."
    throw new Error(message)
  }

  return data as StaffRecord
}

export async function getStaffDetail(id: number): Promise<StaffRecord> {
  const headers: HeadersInit = { "Content-Type": "application/json" }
  const access = getAccessToken()
  if (access) headers["Authorization"] = `Bearer ${access}`

  const response = await fetch(`${API_BASE_URL}/api/staff/${id}/`, { headers })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to load staff profile."
    throw new Error(message)
  }

  return data as StaffRecord
}

export async function deactivateStaff(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/staff/${id}/`, {
    method: "DELETE",
  })

  if (!response.ok) {
    let message = "Unable to deactivate staff member."
    try {
      const data = await response.json()
      if (typeof data?.detail === "string") message = data.detail
      else if (typeof data?.error === "string") message = data.error
    } catch (error) {
      // ignore parsing failure
    }
    throw new Error(message)
  }
}

// ---------- Patient Registration ----------

export interface RegisterPatientParams {
  firstName: string
  lastName: string
  email: string
  username?: string
  password: string
  gender: string
  dateOfBirth: string
  height: number | string
  weight: number | string
}

export interface PatientProfile {
  id: number
  first_name: string
  last_name: string
  email: string
  username: string
  age?: number | null
  gender?: string | null
  date_of_birth?: string | null
  height?: number | null
  weight?: number | null
  bmi?: number | null
  doctor?: number | null
}

export interface PatientAccessRequest {
  id: number
  patient: number
  doctor: number
  status: "pending" | "accepted" | "rejected"
  created_at: string
  updated_at: string
  doctor_name?: string | null
  doctor_email?: string | null
}

export interface UpdatePatientProfileInput {
  firstName?: string
  lastName?: string
  email?: string
  height?: number | string | null
  weight?: number | string | null
}

export interface PatientLoginAttempt {
  id: number
  success: boolean
  timestamp: string
  ip?: string
  userAgent?: string
  detail?: string
}

export interface DoctorPatient extends PatientProfile {
  age?: number | null
  doctor?: number | null
  request_status?: "pending" | "accepted" | "rejected" | null
  request_created_at?: string | null
  request_updated_at?: string | null
  request_doctor_id?: number | null
}

export interface EmailCheckResult {
  exists: boolean
  inPatients: boolean
  inStaff: boolean
}

let staffEmailCache: string[] | null = null

async function loadStaffEmailCache(): Promise<string[]> {
  if (staffEmailCache) return staffEmailCache
  try {
    const staffResponse = await fetch(`${API_BASE_URL}/api/staff/`)
    const staffData = (await staffResponse.json().catch(() => [])) as Array<{
      email?: string
      username?: string
    }>
    if (Array.isArray(staffData)) {
      staffEmailCache = staffData
        .flatMap((s) => [s?.email, s?.username])
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.toLowerCase())
    } else {
      staffEmailCache = []
    }
  } catch (error) {
    staffEmailCache = []
  }
  return staffEmailCache
}

export async function checkEmailExists(email: string): Promise<EmailCheckResult> {
  const clean = email.trim()
  const url = `${API_BASE_URL}/api/register/check-email/?email=${encodeURIComponent(clean)}`
  const response = await fetch(url)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      (typeof data?.error === "string" && data.error) ||
      "Unable to verify email. Please try again."
    throw new Error(message)
  }

  const inPatients = Boolean(data?.patient_exists)
  const inStaff = Boolean(data?.staff_exists)
  const exists = Boolean(data?.exists || inPatients || inStaff)

  // Fallback: if backend does not surface staff conflicts here, double-check via cached staff list (fetched once)
  if (!exists) {
    const cache = await loadStaffEmailCache()
    const lower = clean.toLowerCase()
    if (cache.includes(lower)) {
      return { exists: true, inPatients, inStaff: true }
    }
  }

  return { exists, inPatients, inStaff }
}

function parseNumberOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null
  if (value === "") return null
  const num = typeof value === "number" ? value : Number(value)
  return Number.isNaN(num) ? null : num
}

function extractErrorMessage(data: any, fallback: string) {
  if (!data || typeof data !== "object") return fallback
  if (typeof data.detail === "string") return data.detail

  for (const key of Object.keys(data)) {
    const value = (data as any)[key]
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
      return value[0]
    }
    if (typeof value === "string") return value
  }

  return fallback
}

export async function registerPatient(
  params: RegisterPatientParams,
): Promise<PatientProfile> {
  const payload = {
    first_name: params.firstName.trim(),
    last_name: params.lastName.trim(),
    email: params.email.trim(),
    username: (params.username || params.email).trim(),
    password: params.password,
    gender: params.gender,
    date_of_birth: params.dateOfBirth,
    height: parseNumberOrNull(params.height),
    weight: parseNumberOrNull(params.weight),
  }

  const response = await fetch(`${API_BASE_URL}/api/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = extractErrorMessage(
      data,
      "Unable to sign up. Please check the form and try again.",
    )
    throw new Error(message)
  }

  return data as PatientProfile
}

// ---------- Doctor: Patients & Readings ----------

export interface ReadingRow {
  id?: number
  metric_type: string
  value?: number | string | null
  recorded_at?: string | null
  device?: number | null
  systolic?: number | string | null
  diastolic?: number | string | null
}

export interface ReadingStat {
  metric_type: string
  avg_value: number | null
  max_value: number | null
  min_value: number | null
  count: number
}

export interface ReadingStreaks {
  dates: string[]
  current_streak: number
  longest_streak: number
  start_date: string
  end_date: string
}

export interface AIRecommendation {
  metric?: string
  text: string
}

export interface AIChatResponse {
  answer: string
  summary?: Record<string, unknown>
  risk_flags?: string[]
}

export interface AlertRecord {
  id: number
  metric_type: string
  message: string
  severity: string
  triggered_at: string
}

export type ThresholdMetricType =
  | "heart_rate"
  | "glucose"
  | "steps"
  | "calories"
  | "oxygen"
  | "weight"
  | "bmi"

export type ThresholdCondition = "above" | "below" | "equal"

export interface ThresholdRecord {
  id: number
  patient: number
  metric_type: ThresholdMetricType
  condition: ThresholdCondition
  value: number
  is_active: boolean
  created_at: string
}

export interface CreateThresholdInput {
  metricType: ThresholdMetricType
  condition: ThresholdCondition
  value: number
  isActive?: boolean
  patientId?: number
}

export interface UpdateThresholdInput {
  metricType?: ThresholdMetricType
  condition?: ThresholdCondition
  value?: number
  isActive?: boolean
  patientId?: number
}

export type GoalMetricType =
  | "heart_rate"
  | "glucose"
  | "steps"
  | "calories"
  | "oxygen"
  | "weight"

export interface GoalRecord {
  id: number
  patient: number
  metric_type: GoalMetricType
  target_value: number
  current_value?: number | null
  start_date: string
  end_date?: string | null
  is_active: boolean
  created_at: string
}

export interface CreateGoalInput {
  metricType: GoalMetricType
  targetValue: number
  startDate?: string
  endDate?: string | null
  currentValue?: number | null
  isActive?: boolean
  patientId?: number
}

export interface UpdateGoalInput {
  metricType?: GoalMetricType
  targetValue?: number
  startDate?: string | null
  endDate?: string | null
  currentValue?: number | null
  isActive?: boolean
  patientId?: number
}

export interface ListReadingsParams {
  patientId?: number
  metricType?: string
  startDate?: string
  endDate?: string
  limit?: number
}

function buildQuery(params: Record<string, string | number | undefined | null>) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return
    qs.set(key, String(value))
  })
  const rendered = qs.toString()
  return rendered ? `?${rendered}` : ""
}

export async function listDoctorPatients(): Promise<DoctorPatient[]> {
  // Doctor-specific roster (assigned + pending)
  const response = await fetch(`${API_BASE_URL}/api/doctor/patients/`, {
    headers: authHeaders(),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to load patients."
    throw new Error(message)
  }

  return data as DoctorPatient[]
}

export async function listAllPatients(): Promise<DoctorPatient[]> {
  // Full directory (admin/doctor search)
  const response = await fetch(`${API_BASE_URL}/api/patients/`, {
    headers: authHeaders(),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to load patients."
    throw new Error(message)
  }

  return data as DoctorPatient[]
}

export async function requestDoctorPatient(patientId: number): Promise<DoctorPatient> {
  const response = await fetch(`${API_BASE_URL}/api/doctor/patients/request/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ patient_id: patientId }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to request patient."
    throw new Error(message)
  }

  if ((data as any).patient) return (data as any).patient as DoctorPatient
  return data as DoctorPatient
}

export async function cancelDoctorPatientRequest(patientId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/doctor/patients/request/cancel/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ patient_id: patientId }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to cancel request."
    throw new Error(message)
  }
}

export async function removeDoctorPatient(patientId: number): Promise<DoctorPatient> {
  const response = await fetch(`${API_BASE_URL}/api/doctor/patients/remove/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ patient_id: patientId }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to remove patient."
    throw new Error(message)
  }

  if ((data as any).patient) return (data as any).patient as DoctorPatient
  return data as DoctorPatient
}

export async function getPatientDetail(id: number): Promise<PatientProfile> {
  const response = await fetch(`${API_BASE_URL}/api/patients/${id}/`, {
    headers: authHeaders(),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to load patient."
    throw new Error(message)
  }

  return data as PatientProfile
}

export async function getPatientPublic(id: number): Promise<{ id: number; bmi?: number | null }> {
  const response = await fetch(`${API_BASE_URL}/api/patients/public/${id}/`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to load public patient info."
    throw new Error(message)
  }
  return data as { id: number; bmi?: number | null }
}

export async function getPatientProfile(): Promise<PatientProfile> {
  const response = await fetch(`${API_BASE_URL}/api/patients/profile/`, {
    headers: authHeaders(),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to load patient profile."
    throw new Error(message)
  }

  return data as PatientProfile
}

export async function listPatientAccessRequests(): Promise<PatientAccessRequest[]> {
  const response = await fetch(`${API_BASE_URL}/api/patients/requests/`, {
    headers: authHeaders(),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to load access requests."
    throw new Error(message)
  }

  return data as PatientAccessRequest[]
}

export async function respondPatientAccessRequest(doctorId: number, decision: "accept" | "reject"): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/patients/requests/respond/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ doctor_id: doctorId, decision }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to update request."
    throw new Error(message)
  }
}

export async function updatePatientProfile(input: UpdatePatientProfileInput): Promise<PatientProfile> {
  const payload: Record<string, unknown> = {}
  if (input.firstName !== undefined) payload.first_name = input.firstName.trim()
  if (input.lastName !== undefined) payload.last_name = input.lastName.trim()
  if (input.email !== undefined) {
    payload.email = input.email.trim()
    payload.username = input.email.trim()
  }
  if (input.height !== undefined) payload.height = parseNumberOrNull(input.height)
  if (input.weight !== undefined) payload.weight = parseNumberOrNull(input.weight)

  const response = await fetch(`${API_BASE_URL}/api/patients/profile/`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = extractErrorMessage(data, "Unable to update profile.")
    throw new Error(message)
  }

  return data as PatientProfile
}

export async function changePatientPassword(oldPassword: string, newPassword: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/patients/password/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      old_password: oldPassword,
      new_password: newPassword,
      confirm_password: newPassword,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = extractErrorMessage(data, "Unable to update password.")
    throw new Error(message)
  }
}

export async function checkPatientPassword(password: string): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/api/patients/password/check/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ password }),
  })

  const data = await response.json().catch(() => ({}))
  if (response.status === 401) return false
  if (!response.ok) {
    const message = extractErrorMessage(data, "Unable to verify password.")
    throw new Error(message)
  }
  return Boolean((data as any).valid)
}

export async function getPatientLoginAttempts(limit = 15): Promise<PatientLoginAttempt[]> {
  const query = buildQuery({ limit })
  const response = await fetch(`${API_BASE_URL}/api/patients/login-attempts/${query}`, {
    headers: authHeaders(),
  })

  const data = await response.json().catch(() => [])
  if (!response.ok) {
    const message = extractErrorMessage(data, "Unable to load login attempts.")
    throw new Error(message)
  }

  if (!Array.isArray(data)) return []

  return data.map((attempt) => ({
    id: Number(attempt.id ?? 0),
    success: Boolean((attempt as any).success),
    timestamp: typeof attempt.timestamp === "string" ? attempt.timestamp : "",
    ip: typeof attempt.ip === "string" ? attempt.ip : undefined,
    userAgent:
      typeof (attempt as any).user_agent === "string"
        ? (attempt as any).user_agent
        : typeof (attempt as any).userAgent === "string"
          ? (attempt as any).userAgent
          : undefined,
    detail: typeof attempt.detail === "string" ? attempt.detail : undefined,
  }))
}

export async function listReadings(params: ListReadingsParams = {}): Promise<ReadingRow[]> {
  const storedPatientId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("patientId")
      : null
  const query = buildQuery({
    patient_id: params.patientId ?? (storedPatientId ? Number(storedPatientId) : undefined),
    metric_type: params.metricType,
    start_date: params.startDate,
    end_date: params.endDate,
    limit: params.limit,
  })

  const response = await fetch(`${API_BASE_URL}/api/readings/${query}`, {
    headers: authHeaders(),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to load readings."
    throw new Error(message)
  }

  if (!Array.isArray(data)) return []
  return data as ReadingRow[]
}

export async function getReadingStats(patientId: number, days = 7): Promise<ReadingStat[]> {
  const query = buildQuery({ patient_id: patientId, days })

  const response = await fetch(`${API_BASE_URL}/api/readings/stats/${query}`, {
    headers: authHeaders(),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to load reading stats."
    throw new Error(message)
  }

  if (!Array.isArray(data)) return []
  return data as ReadingStat[]
}

export async function getReadingStreaks(patientId: number): Promise<ReadingStreaks | null> {
  const query = buildQuery({ patient_id: patientId })
  const response = await fetch(`${API_BASE_URL}/api/readings/streaks/${query}`, {
    headers: authHeaders(),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to load streaks."
    throw new Error(message)
  }
  return data as ReadingStreaks
}

export async function createReading(payload: Record<string, unknown>): Promise<ReadingRow> {
  const body: Record<string, unknown> = { ...payload }

  // attach patient id from localStorage when available and not provided
  const storedPatientId = typeof window !== "undefined" ? window.localStorage.getItem("patientId") : null
  if (storedPatientId && body.patient == null) body.patient = Number(storedPatientId)

  const response = await fetch(`${API_BASE_URL}/api/readings/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = extractErrorMessage(data, "Unable to create reading.")
    throw new Error(message)
  }

  return data as ReadingRow
}

export async function getAIRecommendations(days = 7): Promise<AIRecommendation[]> {
  const query = buildQuery({ days })
  const response = await fetch(`${API_BASE_URL}/api/recommendations/${query}`, {
    headers: authHeaders(),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to load recommendations."
    throw new Error(message)
  }
  if (Array.isArray((data as any).recommendations)) {
    return (data as any).recommendations as AIRecommendation[]
  }
  return []
}

export async function aiChat(input: { message: string; patientId?: number; days?: number }): Promise<AIChatResponse> {
  const { message, patientId, days = 7 } = input
  const body: Record<string, unknown> = { message }
  if (patientId !== undefined) body.patient_id = patientId

  const query = buildQuery({ days })

  const response = await fetch(`${API_BASE_URL}/api/ai/chat/${query}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const messageText =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to chat with the assistant."
    throw new Error(messageText)
  }

  return data as AIChatResponse
}

export async function listAlerts(): Promise<AlertRecord[]> {
  const response = await fetch(`${API_BASE_URL}/api/alerts/`, {
    headers: authHeaders(),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to load alerts."
    throw new Error(message)
  }
  if (!Array.isArray(data)) return []
  return data as AlertRecord[]
}

// ---------- Thresholds ----------

export async function listThresholds(params: { patientId?: number } = {}): Promise<ThresholdRecord[]> {
  const query = buildQuery({ patient_id: params.patientId })

  const response = await fetch(`${API_BASE_URL}/api/thresholds/${query}`, {
    headers: authHeaders(),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to load thresholds."
    throw new Error(message)
  }

  if (!Array.isArray(data)) return []
  return data as ThresholdRecord[]
}

function mapThresholdInput(input: CreateThresholdInput | UpdateThresholdInput) {
  const payload: Record<string, unknown> = {}
  if (input.patientId !== undefined) payload.patient = input.patientId
  if (input.metricType !== undefined) payload.metric_type = input.metricType
  if (input.condition !== undefined) payload.condition = input.condition
  if (input.value !== undefined) payload.value = input.value
  if (input.isActive !== undefined) payload.is_active = input.isActive
  return payload
}

export async function createThreshold(input: CreateThresholdInput): Promise<ThresholdRecord> {
  const body = mapThresholdInput(input)

  const response = await fetch(`${API_BASE_URL}/api/thresholds/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = extractErrorMessage(data, "Unable to create threshold.")
    throw new Error(message)
  }

  return data as ThresholdRecord
}

export async function updateThreshold(id: number, input: UpdateThresholdInput): Promise<ThresholdRecord> {
  const body = mapThresholdInput(input)
  if (Object.keys(body).length === 0) {
    throw new Error("No changes provided for threshold update.")
  }

  const response = await fetch(`${API_BASE_URL}/api/thresholds/${id}/`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = extractErrorMessage(data, "Unable to update threshold.")
    throw new Error(message)
  }

  return data as ThresholdRecord
}

// ---------- Goals ----------

function normalizeGoalDates(date?: string) {
  return date || new Date().toISOString().slice(0, 10)
}

function mapGoalInput(input: CreateGoalInput) {
  return {
    patient: input.patientId,
    metric_type: input.metricType,
    target_value: input.targetValue,
    current_value: input.currentValue ?? null,
    start_date: normalizeGoalDates(input.startDate),
    end_date: input.endDate ?? null,
    is_active: input.isActive ?? true,
  }
}

export async function listGoals(params: { patientId?: number } = {}): Promise<GoalRecord[]> {
  const query = buildQuery({ patient_id: params.patientId })

  const response = await fetch(`${API_BASE_URL}/api/goals/${query}`, {
    headers: authHeaders(),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      "Unable to load goals."
    throw new Error(message)
  }

  if (!Array.isArray(data)) return []
  return data as GoalRecord[]
}

export async function createGoal(input: CreateGoalInput): Promise<GoalRecord> {
  const body = mapGoalInput(input)

  const response = await fetch(`${API_BASE_URL}/api/goals/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = extractErrorMessage(data, "Unable to create goal.")
    throw new Error(message)
  }

  return data as GoalRecord
}

export async function updateGoal(id: number, input: UpdateGoalInput): Promise<GoalRecord> {
  const payload: Record<string, unknown> = {}
  if (input.patientId !== undefined) payload.patient = input.patientId
  if (input.metricType !== undefined) payload.metric_type = input.metricType
  if (input.targetValue !== undefined) payload.target_value = input.targetValue
  if (input.currentValue !== undefined) payload.current_value = input.currentValue
  if (input.startDate !== undefined) payload.start_date =
    input.startDate === null ? null : normalizeGoalDates(input.startDate)
  if (input.endDate !== undefined) payload.end_date = input.endDate
  if (input.isActive !== undefined) payload.is_active = input.isActive

  if (Object.keys(payload).length === 0) {
    throw new Error("No changes provided for goal update.")
  }

  const response = await fetch(`${API_BASE_URL}/api/goals/${id}/`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = extractErrorMessage(data, "Unable to update goal.")
    throw new Error(message)
  }

  return data as GoalRecord
}

// ================================
// Password Reset / Forgot Password
// ================================

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/password-reset/request/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = extractErrorMessage(data, "Failed to request password reset.")
    throw new Error(message)
  }

  return data as { message: string }
}

export async function verifyOTP(email: string, otp: string): Promise<{ valid: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/password-reset/verify/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = extractErrorMessage(data, "Invalid or expired OTP.")
    throw new Error(message)
  }

  return data as { valid: boolean; message: string }
}

export async function resetPassword(email: string, otp: string, newPassword: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/password-reset/reset/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp, new_password: newPassword }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = extractErrorMessage(data, "Failed to reset password.")
    throw new Error(message)
  }

  return data as { message: string }
}

