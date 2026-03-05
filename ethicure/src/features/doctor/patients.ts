export type RiskLevel = "low" | "moderate" | "high"

export type MetricSnapshot = {
  heartRate: number
  systolic: number
  diastolic: number
  glucose: number
  oxygen: number
  steps: number
  bmi: number
}

export type PatientSummary = {
  id: string
  firstName: string
  lastName: string
  email: string
  age: number
  gender: string
  location: string
  lastSync: string
  risk: RiskLevel
  metrics: MetricSnapshot
}

export const MAX_ASSIGNED = 5

export const PATIENT_DIRECTORY: PatientSummary[] = [
  {
    id: "PAT-1001",
    firstName: "Lena",
    lastName: "Ortiz",
    email: "lena.ortiz@health.io",
    age: 42,
    gender: "F",
    location: "Dubai, UAE",
    lastSync: "8m ago",
    risk: "moderate",
    metrics: { heartRate: 78, systolic: 122, diastolic: 78, glucose: 98, oxygen: 98, steps: 8300, bmi: 23.6 },
  },
  {
    id: "PAT-1002",
    firstName: "Samuel",
    lastName: "Lee",
    email: "samuel.lee@health.io",
    age: 55,
    gender: "M",
    location: "London, UK",
    lastSync: "12m ago",
    risk: "high",
    metrics: { heartRate: 92, systolic: 138, diastolic: 86, glucose: 132, oxygen: 95, steps: 5400, bmi: 28.1 },
  },
  {
    id: "PAT-1003",
    firstName: "Priya",
    lastName: "Natarajan",
    email: "priya.natarajan@health.io",
    age: 36,
    gender: "F",
    location: "Bengaluru, India",
    lastSync: "21m ago",
    risk: "low",
    metrics: { heartRate: 71, systolic: 116, diastolic: 74, glucose: 104, oxygen: 99, steps: 10200, bmi: 22.4 },
  },
  {
    id: "PAT-1004",
    firstName: "David",
    lastName: "Nguyen",
    email: "david.nguyen@health.io",
    age: 61,
    gender: "M",
    location: "Singapore",
    lastSync: "35m ago",
    risk: "moderate",
    metrics: { heartRate: 84, systolic: 129, diastolic: 82, glucose: 118, oxygen: 97, steps: 6900, bmi: 25.9 },
  },
  {
    id: "PAT-1005",
    firstName: "Amira",
    lastName: "Hassan",
    email: "amira.hassan@health.io",
    age: 47,
    gender: "F",
    location: "Riyadh, KSA",
    lastSync: "1h ago",
    risk: "moderate",
    metrics: { heartRate: 80, systolic: 124, diastolic: 79, glucose: 110, oxygen: 98, steps: 7600, bmi: 24.8 },
  },
  {
    id: "PAT-1006",
    firstName: "Jonas",
    lastName: "Wirth",
    email: "jonas.wirth@health.io",
    age: 50,
    gender: "M",
    location: "Berlin, DE",
    lastSync: "2h ago",
    risk: "low",
    metrics: { heartRate: 69, systolic: 114, diastolic: 72, glucose: 96, oxygen: 99, steps: 11200, bmi: 23.1 },
  },
  {
    id: "PAT-1007",
    firstName: "Chloe",
    lastName: "Martin",
    email: "chloe.martin@health.io",
    age: 29,
    gender: "F",
    location: "Paris, FR",
    lastSync: "3h ago",
    risk: "low",
    metrics: { heartRate: 74, systolic: 118, diastolic: 76, glucose: 92, oxygen: 99, steps: 9800, bmi: 21.7 },
  },
  {
    id: "PAT-1008",
    firstName: "Noah",
    lastName: "Carter",
    email: "noah.carter@health.io",
    age: 33,
    gender: "M",
    location: "Toronto, CA",
    lastSync: "4h ago",
    risk: "moderate",
    metrics: { heartRate: 77, systolic: 121, diastolic: 79, glucose: 106, oxygen: 98, steps: 8700, bmi: 24.2 },
  },
]

export const riskTone: Record<RiskLevel, string> = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  moderate: "border-amber-200 bg-amber-50 text-amber-700",
  high: "border-red-200 bg-red-50 text-red-700",
}

type NameLike = Partial<PatientSummary> & { first_name?: string; last_name?: string; username?: string }

export const formatName = (patient: NameLike) => {
  const first = patient.firstName ?? patient.first_name ?? ""
  const last = patient.lastName ?? patient.last_name ?? ""
  const composed = `${first} ${last}`.trim()
  if (composed) return composed
  return patient.email || patient.username || "Patient"
}