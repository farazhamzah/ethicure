import { useMemo } from "react"
import { useParams } from "react-router-dom"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import ReportsPage from "@/features/patient/pages/reports"

export default function PatientReportsPage() {
  const { id } = useParams()
  const patientId = useMemo(() => (id ? Number(id) : NaN), [id])

  if (!id || Number.isNaN(patientId)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Patient reports</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Invalid patient id.</CardContent>
      </Card>
    )
  }

  return (
    <ReportsPage
      patientId={patientId}
      title="Patient Reports"
      description="Generate and download clinical report PDFs for this connected patient."
    />
  )
}
