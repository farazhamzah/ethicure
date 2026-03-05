"use client"

import * as React from "react"
import { format, subDays } from "date-fns"
import type { DateRange } from "react-day-picker"
import {
  Activity,
  Calendar as CalendarIcon,
  ChevronDown,
  Download,
  FileText,
  Flame,
  Footprints,
  HeartPulse,
  Loader2,
  Moon,
  Share2,
  Stethoscope,
  Waves,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { API_BASE_URL } from "@/lib/api"

type MetricId =
  | "heart-rate"
  | "blood-pressure"
  | "glucose"
  | "oxygen"
  | "sleep"
  | "calories"
  | "steps"

type SubMetricId =
  | "afib"
  | "ecg"
  | "bpm"
  | "systolic"
  | "diastolic"
  | "glucose-fasting"
  | "glucose-post"
  | "glucose-average"
  | "spo2"
  | "variability"
  | "sleep-rem"
  | "sleep-deep"
  | "sleep-light"
  | "calories-active"
  | "calories-resting"
  | "steps-daily"
  | "steps-weekly"

type MetricDefinition = {
  id: MetricId
  label: string
  description: string
  icon: React.ReactNode
  subMetrics: { id: SubMetricId; label: string }[]
}

const METRICS: MetricDefinition[] = [
  {
    id: "heart-rate",
    label: "Heart Rate",
    description: "Rhythm monitoring and arrhythmia signals.",
    icon: <HeartPulse className="h-4 w-4" />,
    subMetrics: [
      { id: "afib", label: "AFIB" },
      { id: "ecg", label: "ECG" },
      { id: "bpm", label: "BPM" },
    ],
  },
  {
    id: "blood-pressure",
    label: "Blood Pressure",
    description: "Tension variability and stability.",
    icon: <Stethoscope className="h-4 w-4" />,
    subMetrics: [
      { id: "systolic", label: "Systolic" },
      { id: "diastolic", label: "Diastolic" },
    ],
  },
  {
    id: "glucose",
    label: "Glucose",
    description: "Glycemic control snapshots.",
    icon: <Activity className="h-4 w-4" />,
    subMetrics: [
      { id: "glucose-fasting", label: "Fasting" },
      { id: "glucose-post", label: "Post-Meal" },
      { id: "glucose-average", label: "Average" },
    ],
  },
  {
    id: "oxygen",
    label: "Oxygen",
    description: "Saturation and variability trends.",
    icon: <Waves className="h-4 w-4" />,
    subMetrics: [
      { id: "spo2", label: "SpO2" },
      { id: "variability", label: "Variability" },
    ],
  },
  {
    id: "sleep",
    label: "Sleep",
    description: "Stage balance across the range.",
    icon: <Moon className="h-4 w-4" />,
    subMetrics: [
      { id: "sleep-rem", label: "REM" },
      { id: "sleep-deep", label: "Deep" },
      { id: "sleep-light", label: "Light" },
    ],
  },
  {
    id: "calories",
    label: "Calories",
    description: "Output and recovery balance.",
    icon: <Flame className="h-4 w-4" />,
    subMetrics: [
      { id: "calories-active", label: "Active" },
      { id: "calories-resting", label: "Resting" },
    ],
  },
  {
    id: "steps",
    label: "Steps",
    description: "Movement consistency and cadence.",
    icon: <Footprints className="h-4 w-4" />,
    subMetrics: [
      { id: "steps-daily", label: "Daily Total" },
      { id: "steps-weekly", label: "Weekly Average" },
    ],
  },
]

const DEFAULT_SELECTION: Record<MetricId, SubMetricId[]> = {
  "heart-rate": ["bpm", "afib"],
  "blood-pressure": ["systolic", "diastolic"],
  glucose: ["glucose-average"],
  oxygen: ["spo2"],
  sleep: ["sleep-rem", "sleep-deep"],
  calories: ["calories-active"],
  steps: ["steps-daily"],
}

type ReportSummaryMetric = {
  metric_type: string
  avg_value: number | null
  max_value: number | null
  min_value: number | null
  count: number
}

type ReportAlert = {
  id: number
  metric_type: string
  message: string
  severity: string
  triggered_at: string
}

type ReportPdfPayload = {
  report_id: number
  title: string
  report_type: string
  period: { start: string; end: string }
  patient: {
    name?: string
    email?: string
    age?: number | null
    gender?: string | null
    bmi?: number | null
    dob?: string | null
  }
  summary: {
    total_readings: number
    total_alerts: number
    metrics: ReportSummaryMetric[]
  }
  alerts: ReportAlert[]
  generated_at: string
}

const METRIC_LABELS: Record<string, string> = {
  heart_rate: "Heart Rate",
  heart_hrv_ms: "Heart HRV (ms)",
  heart_rr_interval_ms: "RR Interval (ms)",
  bp_systolic: "Blood Pressure (Systolic)",
  bp_diastolic: "Blood Pressure (Diastolic)",
  bp_mean: "Blood Pressure (Mean)",
  bp_pulse_pressure: "Pulse Pressure",
  glucose: "Glucose",
  glucose_hba1c: "HbA1c",
  steps: "Steps",
  daily_steps: "Daily Steps",
  step_distance_km: "Step Distance (km)",
  walking_pace: "Walking Pace",
  cadence: "Cadence",
  floors_climbed: "Floors Climbed",
  calories: "Total Calories",
  basal_calories: "Basal Calories",
  metabolic_equivalent: "MET",
  oxygen: "Oxygen",
  oxygen_variability: "Oxygen Variability",
  vo2_max: "VO2 Max",
  respiration_rate: "Respiration Rate",
  sleep_duration_minutes: "Sleep Duration (min)",
  sleep_score: "Sleep Score",
}

const METRIC_GROUP_TO_KEYS: Record<MetricId, string[]> = {
  "heart-rate": ["heart_rate", "heart_hrv_ms", "heart_rr_interval_ms"],
  "blood-pressure": ["bp_systolic", "bp_diastolic", "bp_mean", "bp_pulse_pressure"],
  glucose: ["glucose", "glucose_hba1c"],
  oxygen: ["oxygen", "oxygen_variability", "respiration_rate", "vo2_max"],
  sleep: ["sleep_score", "sleep_duration_minutes"],
  calories: ["calories", "basal_calories", "metabolic_equivalent"],
  steps: ["steps", "daily_steps", "step_distance_km", "walking_pace", "cadence", "floors_climbed"],
}

const formatNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "n/a"
  if (Number.isInteger(value)) return String(value)
  return Number(value).toFixed(1)
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(() => {
    const to = new Date()
    const from = subDays(to, 29)
    return { from, to }
  })
  const [openSections, setOpenSections] = React.useState<MetricId[]>([])
  const [selectedMetrics, setSelectedMetrics] = React.useState<
    Record<MetricId, Set<SubMetricId>>
  >(() => {
    const mapped: Record<MetricId, Set<SubMetricId>> = {
      "heart-rate": new Set(DEFAULT_SELECTION["heart-rate"]),
      "blood-pressure": new Set(DEFAULT_SELECTION["blood-pressure"]),
      glucose: new Set(DEFAULT_SELECTION.glucose),
      oxygen: new Set(DEFAULT_SELECTION.oxygen),
      sleep: new Set(DEFAULT_SELECTION.sleep),
      calories: new Set(DEFAULT_SELECTION.calories),
      steps: new Set(DEFAULT_SELECTION.steps),
    }
    return mapped
  })
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = React.useState<Date | null>(null)
  const [reportData, setReportData] = React.useState<ReportPdfPayload | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [shareOpen, setShareOpen] = React.useState(false)

  const rangeLabel = React.useMemo(() => {
    if (dateRange?.from && dateRange.to) {
      return `${format(dateRange.from, "PPP")} - ${format(dateRange.to, "PPP")}`
    }
    if (dateRange?.from) {
      return `${format(dateRange.from, "PPP")} - end date`
    }
    return "Pick a date range"
  }, [dateRange])

  const activeMetrics = METRICS.filter(
    (metric) => selectedMetrics[metric.id]?.size
  )

  const selectedMetricTypes = React.useMemo(() => {
    const set = new Set<string>()
    activeMetrics.forEach((metric) => {
      const keys = METRIC_GROUP_TO_KEYS[metric.id] || []
      keys.forEach((key) => set.add(key))
    })
    return set
  }, [activeMetrics])

  React.useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [pdfUrl])

  const toggleSection = (id: MetricId) => {
    setOpenSections((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleParentToggle = (metric: MetricDefinition, checked: boolean) => {
    setSelectedMetrics((prev) => {
      const next = new Set<SubMetricId>()
      if (checked) {
        metric.subMetrics.forEach((sub) => next.add(sub.id))
      }

      return { ...prev, [metric.id]: next }
    })
  }

  const handleSubToggle = (
    metric: MetricDefinition,
    subId: SubMetricId,
    checked: boolean
  ) => {
    setSelectedMetrics((prev) => {
      const current = new Set(prev[metric.id] ?? [])
      if (checked) {
        current.add(subId)
      } else {
        current.delete(subId)
      }
      return { ...prev, [metric.id]: current }
    })
  }

  const parentState = React.useCallback(
    (metric: MetricDefinition) => {
      const selected = selectedMetrics[metric.id]?.size ?? 0
      if (!selected) return false
      if (selected === metric.subMetrics.length) return true
      return "mixed"
    },
    [selectedMetrics]
  )

  // const buildPdfDocument = async (data: ReportPdfPayload) => {
  //   const { jsPDF } = await import("jspdf")
  //   const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  //   const margin = 16
  //   let cursorY = 18

  //   const accent = { r: 69, g: 109, b: 255 }
  //   const border = { r: 214, g: 219, b: 227 }
  //   const mutedBg = { r: 244, g: 245, b: 247 }

  //   const drawSectionTitle = (label: string) => {
  //     pdf.setFontSize(12.5)
  //     pdf.setTextColor(34, 42, 55)
  //     pdf.text(label, margin, cursorY)
  //     pdf.setDrawColor(accent.r, accent.g, accent.b)
  //     pdf.setLineWidth(0.4)
  //     pdf.line(margin, cursorY + 1.5, margin + 40, cursorY + 1.5)
  //     cursorY += 8
  //   }

  //   // Title block with accent background
  //   pdf.setFillColor(mutedBg.r, mutedBg.g, mutedBg.b)
  //   pdf.setDrawColor(border.r, border.g, border.b)
  //   pdf.rect(margin - 2, cursorY - 6, 180, 16, "FD")

  //   pdf.setFontSize(16)
  //   pdf.setTextColor(28, 35, 48)
  //   pdf.text(data.title || "Health Report", margin, cursorY)
  //   cursorY += 7

  //   pdf.setFontSize(10.5)
  //   pdf.setTextColor(64, 70, 78)
  //   const infoLines = [
  //     `Patient: ${data.patient?.name || "n/a"}`,
  //     `Period: ${data.period.start} to ${data.period.end}`,
  //     `Generated: ${new Date(data.generated_at).toLocaleString()}`,
  //   ]
  //   infoLines.forEach((line) => {
  //     pdf.text(line, margin, cursorY)
  //     cursorY += 5
  //   })
  //   cursorY += 4

  //   drawSectionTitle("Sub-metrics (readings_draft)")

  //   const summaryMetrics = (data.summary?.metrics || []).filter(
  //     (metric) => !selectedMetricTypes.size || selectedMetricTypes.has(metric.metric_type)
  //   )

  //   if (!summaryMetrics.length) {
  //     pdf.setFontSize(10)
  //     pdf.text("No readings for the selected metrics in this date range.", margin, cursorY)
  //     cursorY += 6
  //   } else {
  //     const cols: Array<{ key: string; label: string; width: number; align: "left" | "right" }> = [
  //       { key: "metric", label: "Metric", width: 80, align: "left" },
  //       { key: "avg", label: "Avg", width: 30, align: "right" },
  //       { key: "min", label: "Min", width: 30, align: "right" },
  //       { key: "max", label: "Max", width: 30, align: "right" },
  //       { key: "count", label: "Count", width: 30, align: "right" },
  //     ]

  //     const tableX = margin
  //     const headerHeight = 11
  //     const rowHeight = 9.5
  //     const tableWidth = cols.reduce((sum, col) => sum + col.width, 0)
  //     const pageHeight = pdf.internal.pageSize.getHeight()

  //     const rows = summaryMetrics.map((metric) => ({
  //       metric: METRIC_LABELS[metric.metric_type] || metric.metric_type,
  //       avg: formatNumber(metric.avg_value),
  //       min: formatNumber(metric.min_value),
  //       max: formatNumber(metric.max_value),
  //       count: String(metric.count),
  //     }))

  //     const drawHeader = (y: number) => {
  //       let cursorX = tableX
  //       pdf.setFillColor(mutedBg.r, mutedBg.g, mutedBg.b)
  //       pdf.setDrawColor(border.r, border.g, border.b)
  //       pdf.rect(tableX, y - 2, tableWidth, headerHeight, "FD")
  //       pdf.setFontSize(9.5)
  //       pdf.setTextColor(46, 56, 74)
  //       cols.forEach((col) => {
  //         cellText(cursorX, y - 2, col.label, col.width, col.align, true)
  //         cursorX += col.width
  //       })
  //     }

  //     const cellText = (
  //       x: number,
  //       y: number,
  //       text: string,
  //       width: number,
  //       align: "left" | "right",
  //       isHeader = false
  //     ) => {
  //       const padding = isHeader ? 4.5 : 4
  //       const baseline = y + (isHeader ? headerHeight / 2 + 1.5 : rowHeight / 2 + 1.5)
  //       let tx = x + padding
  //       if (align === "right") {
  //         tx = x + width - padding - pdf.getTextWidth(text)
  //       }
  //       pdf.text(text, tx, baseline)
  //     }

  //     // Header row
  //     drawHeader(cursorY)
  //     cursorY += headerHeight

  //     // Body rows
  //     pdf.setTextColor(32, 36, 44)
  //     rows.forEach((row, index) => {
  //       // Page break if needed
  //       if (cursorY + rowHeight + 10 > pageHeight - margin) {
  //         pdf.addPage()
  //         cursorY = margin
  //         drawHeader(cursorY)
  //         cursorY += headerHeight
  //       }

  //       let cursorX = tableX
  //       const isStriped = index % 2 === 0
  //       if (isStriped) {
  //         pdf.setFillColor(250, 251, 252)
  //         pdf.rect(tableX, cursorY - 2, tableWidth, rowHeight, "F")
  //       }
  //       cols.forEach((col) => {
  //         const value = row[col.key as keyof typeof row] as string
  //         cellText(cursorX, cursorY - 2, value, col.width, col.align)
  //         cursorX += col.width
  //       })
  //       cursorY += rowHeight
  //     })

  //     pdf.setDrawColor(border.r, border.g, border.b)
  //     pdf.rect(
  //       tableX,
  //       cursorY - headerHeight - rows.length * rowHeight,
  //       tableWidth,
  //       headerHeight + rows.length * rowHeight
  //     )
  //   }

  //   cursorY += 10
  //   pdf.setFontSize(9)
  //   pdf.text(
  //     "Source: readings_draft data. Informational only; not a clinical diagnosis.",
  //     margin,
  //     cursorY
  //   )

  //   return pdf
  // }
  const buildPdfDocument = async (data: ReportPdfPayload) => {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  
  // Odoo-style colors - professional blue/gray palette
  const colors = {
    primary: { r: 46, g: 84, b: 129 },        // Odoo blue
    headerBg: { r: 240, g: 242, b: 245 },     // Light gray for headers
    tableBorder: { r: 206, g: 212, b: 218 },  // Table borders
    textDark: { r: 33, g: 37, b: 41 },        // Primary text
    textMuted: { r: 108, g: 117, b: 125 },    // Secondary text
    white: { r: 255, g: 255, b: 255 },        // White background
    altRow: { r: 248, g: 249, b: 250 },       // Alternate row
  }

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - 2 * margin
  let cursorY = margin

  // === HEADER SECTION (Odoo-style) ===
  // Company name/branding
  pdf.setFontSize(20)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b)
  pdf.text("EthiCure Health", margin, cursorY)
  cursorY += 3
  
  // Subtle line under company name
  pdf.setDrawColor(colors.primary.r, colors.primary.g, colors.primary.b)
  pdf.setLineWidth(0.8)
  pdf.line(margin, cursorY, margin + 50, cursorY)
  cursorY += 10

  // Document title and metadata on right side
  const rightX = pageWidth - margin
  let rightY = margin
  
  pdf.setFontSize(11)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(colors.textDark.r, colors.textDark.g, colors.textDark.b)
  pdf.text("HEALTH REPORT", rightX, rightY, { align: "right" })
  rightY += 6
  
  pdf.setFontSize(9)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b)
  pdf.text(`Report Date: ${format(new Date(data.generated_at), "PP")}`, rightX, rightY, { align: "right" })
  
  cursorY += 5

  // === INFO BOXES (Odoo-style two-column layout) ===
  const boxHeight = 35
  const boxWidth = (contentWidth - 5) / 2
  
  // Left box - Patient Information
  pdf.setDrawColor(colors.tableBorder.r, colors.tableBorder.g, colors.tableBorder.b)
  pdf.setFillColor(colors.white.r, colors.white.g, colors.white.b)
  pdf.setLineWidth(0.3)
  pdf.rect(margin, cursorY, boxWidth, boxHeight, "FD")
  
  let boxY = cursorY + 6
  pdf.setFontSize(9)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b)
  pdf.text("PATIENT INFORMATION", margin + 3, boxY)
  boxY += 6
  
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(colors.textDark.r, colors.textDark.g, colors.textDark.b)
  pdf.setFontSize(8.5)
  pdf.text(`Name: ${data.patient?.name || "N/A"}`, margin + 3, boxY)
  boxY += 5
  pdf.text(`Email: ${data.patient?.email || "N/A"}`, margin + 3, boxY)
  boxY += 5
  if (data.patient?.dob) {
    pdf.text(`DOB: ${data.patient.dob}`, margin + 3, boxY)
    boxY += 5
  }
  if (data.patient?.age) {
    pdf.text(`Age: ${data.patient.age} years`, margin + 3, boxY)
    boxY += 5
  }
  if (data.patient?.gender) {
    pdf.text(`Gender: ${data.patient.gender}`, margin + 3, boxY)
  }
  
  // Right box - Report Details
  const rightBoxX = margin + boxWidth + 5
  pdf.setFillColor(colors.headerBg.r, colors.headerBg.g, colors.headerBg.b)
  pdf.rect(rightBoxX, cursorY, boxWidth, boxHeight, "FD")
  
  boxY = cursorY + 6
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b)
  pdf.text("REPORT DETAILS", rightBoxX + 3, boxY)
  boxY += 6
  
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(colors.textDark.r, colors.textDark.g, colors.textDark.b)
  pdf.text(`Period Start: ${data.period.start}`, rightBoxX + 3, boxY)
  boxY += 5
  pdf.text(`Period End: ${data.period.end}`, rightBoxX + 3, boxY)
  boxY += 5
  pdf.text(`Total Readings: ${data.summary.total_readings}`, rightBoxX + 3, boxY)
  boxY += 5
  pdf.text(`Total Alerts: ${data.summary.total_alerts}`, rightBoxX + 3, boxY)
  
  cursorY += boxHeight + 12

  // === METRICS TABLE (Odoo-style) ===
  pdf.setFontSize(11)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(colors.textDark.r, colors.textDark.g, colors.textDark.b)
  pdf.text("Health Metrics Summary", margin, cursorY)
  cursorY += 7

  const summaryMetrics = (data.summary?.metrics || []).filter(
    (metric) => !selectedMetricTypes.size || selectedMetricTypes.has(metric.metric_type)
  )

  if (!summaryMetrics.length) {
    pdf.setFontSize(9)
    pdf.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b)
    pdf.text("No readings available for the selected metrics in this date range.", margin, cursorY)
  } else {
    // Table configuration
    const cols = [
      { key: "metric", label: "Metric", width: contentWidth * 0.40 },
      { key: "avg", label: "Average", width: contentWidth * 0.15, align: "right" as const },
      { key: "min", label: "Minimum", width: contentWidth * 0.15, align: "right" as const },
      { key: "max", label: "Maximum", width: contentWidth * 0.15, align: "right" as const },
      { key: "count", label: "Count", width: contentWidth * 0.15, align: "right" as const },
    ]

    const rowHeight = 8
    const headerHeight = 9

    const rows = summaryMetrics.map((metric) => ({
      metric: METRIC_LABELS[metric.metric_type] || metric.metric_type,
      avg: formatNumber(metric.avg_value),
      min: formatNumber(metric.min_value),
      max: formatNumber(metric.max_value),
      count: String(metric.count),
    }))

    // Table header with Odoo styling
    pdf.setFillColor(colors.headerBg.r, colors.headerBg.g, colors.headerBg.b)
    pdf.setDrawColor(colors.tableBorder.r, colors.tableBorder.g, colors.tableBorder.b)
    pdf.rect(margin, cursorY, contentWidth, headerHeight, "FD")
    
    pdf.setFontSize(8.5)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(colors.textDark.r, colors.textDark.g, colors.textDark.b)
    
    let colX = margin
    cols.forEach((col) => {
      const text = col.label
      const textX = col.align === "right" ? colX + col.width - 3 : colX + 3
      pdf.text(text, textX, cursorY + 6, { align: col.align || "left" })
      
      // Vertical lines between columns
      if (colX > margin) {
        pdf.setDrawColor(colors.tableBorder.r, colors.tableBorder.g, colors.tableBorder.b)
        pdf.line(colX, cursorY, colX, cursorY + headerHeight)
      }
      colX += col.width
    })
    
    cursorY += headerHeight

    // Table rows
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    
    rows.forEach((row, index) => {
      // Page break if needed
      if (cursorY + rowHeight + 15 > pageHeight - margin) {
        pdf.addPage()
        cursorY = margin
      }

      // Alternating row colors (Odoo style)
      if (index % 2 === 1) {
        pdf.setFillColor(colors.altRow.r, colors.altRow.g, colors.altRow.b)
        pdf.rect(margin, cursorY, contentWidth, rowHeight, "F")
      }

      // Row borders
      pdf.setDrawColor(colors.tableBorder.r, colors.tableBorder.g, colors.tableBorder.b)
      pdf.rect(margin, cursorY, contentWidth, rowHeight, "S")

      // Cell content
      colX = margin
      cols.forEach((col) => {
        const value = row[col.key as keyof typeof row] as string
        const textX = col.align === "right" ? colX + col.width - 3 : colX + 3
        pdf.setTextColor(colors.textDark.r, colors.textDark.g, colors.textDark.b)
        pdf.text(value, textX, cursorY + 5.5, { align: col.align || "left" })
        
        // Vertical lines
        if (colX > margin) {
          pdf.line(colX, cursorY, colX, cursorY + rowHeight)
        }
        colX += col.width
      })
      
      cursorY += rowHeight
    })
  }

  // === FOOTER (Odoo-style) ===
  const footerY = pageHeight - 15
  pdf.setDrawColor(colors.tableBorder.r, colors.tableBorder.g, colors.tableBorder.b)
  pdf.setLineWidth(0.3)
  pdf.line(margin, footerY, pageWidth - margin, footerY)
  
  pdf.setFontSize(7.5)
  pdf.setFont("helvetica", "italic")
  pdf.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b)
  pdf.text("This report is for informational purposes only and does not constitute medical advice.", margin, footerY + 4)
  pdf.text("Source: EthiCure Health Platform - Readings Draft Data", margin, footerY + 8)
  
  // Page number
  pdf.setFont("helvetica", "normal")
  pdf.text(`Page 1`, pageWidth - margin, footerY + 6, { align: "right" })

  return pdf
}

  const generatePdf = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      setError("Select a start and end date for the report.")
      return
    }
    if (!activeMetrics.length) {
      setError("Select at least one metric to include.")
      return
    }

    setIsGenerating(true)
    setError(null)
    setReportData(null)
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl)
      setPdfUrl(null)
    }

    const parseError = (payload: any) => {
      if (payload && typeof payload.error === "string") return payload.error
      if (payload && typeof payload.detail === "string") return payload.detail
      return "Unexpected error from server"
    }

    try {
      const token = window.localStorage.getItem("accessToken")
      if (!token) throw new Error("Missing access token. Please sign in again.")

      const startDate = format(dateRange.from, "yyyy-MM-dd")
      const endDate = format(dateRange.to ?? dateRange.from, "yyyy-MM-dd")

      const patientId = window.localStorage.getItem("patientId")
      const createPayload: Record<string, unknown> = {
        title: `Health Report (${rangeLabel})`,
        report_type: "custom",
        start_date: startDate,
        end_date: endDate,
      }
      if (patientId) createPayload.patient = Number(patientId)

      const createResponse = await fetch(`${API_BASE_URL}/api/reports/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createPayload),
      })

      const created = await createResponse.json().catch(() => ({}))
      if (!createResponse.ok) {
        throw new Error(parseError(created))
      }

      const reportId = created.id
      if (!reportId) {
        throw new Error("Unable to generate report id from backend response.")
      }

      const pdfResponse = await fetch(`${API_BASE_URL}/api/reports/${reportId}/pdf/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const payload = (await pdfResponse.json().catch(() => ({}))) as ReportPdfPayload
      if (!pdfResponse.ok) {
        throw new Error(parseError(payload))
      }

      setReportData(payload)

      const pdf = await buildPdfDocument(payload)
      const blob = pdf.output("blob")
      const url = URL.createObjectURL(blob)
      setPdfUrl(url)
      setGeneratedAt(new Date())
      setShareOpen(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate PDF"
      setError(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadPdf = () => {
    if (!pdfUrl) return
    const link = document.createElement("a")
    link.href = pdfUrl
    link.download = "ethicare-report.pdf"
    link.click()
  }

  const shareReport = async (platform: "whatsapp" | "x" | "facebook") => {
    const shareText = `Health report ${rangeLabel}`
    const targetUrl = pdfUrl || window.location.href

    try {
      if (navigator.share) {
        await navigator.share({ text: shareText, url: targetUrl })
        return
      }
    } catch (error) {
      console.error("Sharing via Web Share failed", error)
    }

    const encodedText = encodeURIComponent(`${shareText} ${targetUrl}`)
    const shareLinks = {
      whatsapp: `https://wa.me/?text=${encodedText}`,
      x: `https://twitter.com/intent/tweet?text=${encodedText}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(targetUrl)}&quote=${encodedText}`,
    }

    window.open(shareLinks[platform], "_blank", "noopener,noreferrer")
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Reporting
        </p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Reports</h1>
            <p className="text-sm text-muted-foreground">
              Structured, clinical reporting with focused metric selection and export options.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              disabled={isGenerating || !activeMetrics.length}
              onClick={generatePdf}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {isGenerating ? "Building PDF" : "Generate PDF"}
            </Button>
            <Button
              variant="secondary"
              className="gap-2"
              disabled={!pdfUrl}
              onClick={downloadPdf}
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button
              variant="secondary"
              className="gap-2"
              disabled={!pdfUrl}
              onClick={() => setShareOpen(true)}
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border border-border/70 bg-card">
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg">Metric Selection</CardTitle>
              <CardDescription>
                Choose metrics and detailed sub-metrics. Parent toggles all children.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {METRICS.map((metric) => {
                const parentChecked = parentState(metric)

                return (
                  <Collapsible
                    key={metric.id}
                    open={openSections.includes(metric.id)}
                    onOpenChange={() => toggleSection(metric.id)}
                    className="rounded-lg border border-border/60 bg-card/60 px-3 py-2"
                  >
                    <div
                      className="flex cursor-pointer items-start justify-between gap-3"
                      onClick={() => toggleSection(metric.id)}
                    >
                      <div className="flex flex-1 items-start gap-3">
                        <Checkbox
                          aria-label={`Select ${metric.label}`}
                          checked={parentChecked === true}
                          indeterminate={parentChecked === "mixed"}
                          onClick={(event) => event.stopPropagation()}
                          onCheckedChange={(checked) =>
                            handleParentToggle(metric, Boolean(checked))
                          }
                        />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-foreground/80">
                              {metric.icon}
                            </span>
                            {metric.label}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {metric.description}
                          </p>
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform",
                          openSections.includes(metric.id) && "rotate-180"
                        )}
                      />
                    </div>
                    <CollapsibleContent className="mt-3 space-y-2 pl-8">
                      {metric.subMetrics.map((sub) => {
                        const isChecked = selectedMetrics[metric.id]?.has(sub.id)
                        return (
                          <label
                            key={sub.id}
                            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted"
                          >
                            <div className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={Boolean(isChecked)}
                                onClick={(event) => event.stopPropagation()}
                                onCheckedChange={(checked) =>
                                  handleSubToggle(metric, sub.id, Boolean(checked))
                                }
                              />
                              <span>{sub.label}</span>
                            </div>
                          </label>
                        )
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
            </CardContent>
          </Card>

          <Card className="border border-border/70 bg-card">
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg">Date Range</CardTitle>
              <CardDescription>Select a start and end date.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Popover>
                <PopoverTrigger
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-full justify-start gap-2 text-left font-normal",
                    !dateRange?.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-4 w-4" />
                  <span className="truncate">
                    {rangeLabel || "Pick a date range"}
                  </span>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    numberOfMonths={2}
                    selected={dateRange}
                    onSelect={setDateRange}
                    defaultMonth={dateRange?.from}
                  />
                </PopoverContent>
              </Popover>
              <div className="text-xs text-muted-foreground">
                Showing data for the selected range. Default is last 30 days.
              </div>
            </CardContent>
          </Card>
        </div>

      {pdfUrl && (
        <Card className="border border-border/70 bg-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">PDF Preview</CardTitle>
            <CardDescription>
              Preview your generated report below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-hidden rounded-lg border border-border/60">
              <iframe
                src={`${pdfUrl}#view=FitV&toolbar=1`}
                className="h-[800px] w-full"
                style={{
                  border: 'none',
                  display: 'block',
                }}
                title="PDF Preview"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={shareOpen} onOpenChange={setShareOpen}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Share report</AlertDialogTitle>
            <AlertDialogDescription>
              PDF built from readings_draft is ready. Download or share directly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2" onClick={downloadPdf} disabled={!pdfUrl}>
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => shareReport("whatsapp")} disabled={!pdfUrl}>
              <Share2 className="h-4 w-4" />
              WhatsApp
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => shareReport("x")} disabled={!pdfUrl}>
              <Share2 className="h-4 w-4" />
              Share to X
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => shareReport("facebook")} disabled={!pdfUrl}>
              <Share2 className="h-4 w-4" />
              Facebook
            </Button>
            {reportData && (
              <div className="basis-full text-xs text-muted-foreground">
                {reportData.summary.total_readings} readings and {reportData.summary.total_alerts} alerts between {reportData.period.start} and {reportData.period.end}.
              </div>
            )}
            {generatedAt && (
              <span className="text-xs text-muted-foreground">
                Generated {generatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShareOpen(false)}>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  )
}
