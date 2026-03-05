import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Outlet } from "react-router-dom"
import { ThemeToggle } from "@/components/theme-toggle"
import useAutoGenerate from "@/hooks/use-auto-generate"

export default function AppLayout() {
  useAutoGenerate()
  return (
    <SidebarProvider defaultOpen>
      {/* IMPORTANT: group is REQUIRED */}
      <div className="group/sidebar-wrapper flex min-h-screen w-full bg-background">
        <AppSidebar />

        <main className="flex flex-1 flex-col">
          <div className="flex h-14 items-center border-b px-4">
            <SidebarTrigger />
            <div className="ml-auto">
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
