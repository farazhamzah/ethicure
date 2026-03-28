import { Activity, ArrowLeft, FileText, LayoutDashboard } from "lucide-react"
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom"
import { useState, type ReactNode } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type DoctorPatientWorkspaceContext = {
  setTopActions: (actions: ReactNode) => void
}

export default function DoctorPatientWorkspaceLayout() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [topActions, setTopActions] = useState<ReactNode>(null)

  if (!id) {
    return (
      <div className="px-4 lg:px-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Invalid patient id.</CardContent>
        </Card>
      </div>
    )
  }

  const tabs = [
    {
      label: "Overview",
      to: `/doctor/patients/${id}`,
      icon: LayoutDashboard,
      end: true,
    },
    {
      label: "Patient data",
      to: `/doctor/patients/${id}/data`,
      icon: Activity,
      end: false,
    },
    {
      label: "Reports",
      to: `/doctor/patients/${id}/reports`,
      icon: FileText,
      end: false,
    },
  ]

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <Card className="border-border/70 bg-gradient-to-b from-background to-muted/30">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/doctor")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to patients
            </Button>
          </div>
          {/* <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Connected patient workspace</p>
            <CardTitle className="text-2xl font-semibold">Patient {id}</CardTitle>
            <CardDescription>
              Navigate between overview, data trends, and reports without leaving this patient context.
            </CardDescription>
          </div> */}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <nav className="flex flex-wrap gap-2" aria-label="Patient workspace tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <NavLink
                    key={tab.to}
                    to={tab.to}
                    end={tab.end}
                    className={({ isActive }) =>
                      cn(
                        buttonVariants({ variant: isActive ? "default" : "outline", size: "sm" }),
                        "gap-2"
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </NavLink>
                )
              })}
            </nav>
            <div className="flex flex-wrap items-center gap-2">{topActions}</div>
          </div>
        </CardContent>
      </Card>

      <Outlet context={{ setTopActions }} />
    </div>
  )
}
