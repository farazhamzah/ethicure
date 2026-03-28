import { useMemo } from "react"
import { useParams } from "react-router-dom"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import YourDataPage from "@/features/patient/pages/your-data"

export default function PatientDataPage() {
  const { id } = useParams()
  const patientId = useMemo(() => (id ? Number(id) : NaN), [id])

  if (!id || Number.isNaN(patientId)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Patient data</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Invalid patient id.</CardContent>
      </Card>
    )
  }

  return (
    <YourDataPage
      patientId={patientId}
      title="Patient Data"
      subtitle="Review this patient's trends across key metrics and time ranges."
    />
  )
}
