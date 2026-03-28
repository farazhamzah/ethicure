import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { DoctorSidebar } from "@/components/doctor-sidebar"
import { Outlet } from "react-router-dom"
import { ThemeToggle } from "@/components/theme-toggle"
import { DebugMenu } from "@/components/debug-menu"

export default function DoctorLayout() {
  return (
    <SidebarProvider defaultOpen>
      <div className="group/sidebar-wrapper flex min-h-screen w-full bg-background">
        <DoctorSidebar />

        <main className="flex flex-1 flex-col">
          <div className="flex h-14 items-center border-b px-4">
            <SidebarTrigger />
            <div className="ml-auto flex items-center gap-1">
              <DebugMenu />
              <ThemeToggle />
            </div>
          </div>

          <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
