"use client"

import * as React from "react"
import { IconDashboard, IconLogout, IconBell } from "@tabler/icons-react"
import { Link } from "react-router-dom"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { API_BASE_URL } from "@/lib/api"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type SidebarUser = {
  name: string
  email?: string
  avatar?: string
  initials?: string
}

const navMain = [
  {
    title: "Doctor Home",
    url: "/doctor",
    icon: IconDashboard,
  },
]

const navSecondary = [
  {
    title: "Notifications",
    url: "/doctor/notifications",
    icon: IconBell,
  },
  {
    title: "Logout",
    url: "/logout",
    icon: IconLogout,
  },
]

export function DoctorSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user, setUser] = React.useState<SidebarUser>(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("username") : null
    const name = stored || "Doctor"
    return {
      name,
      email: stored || undefined,
      avatar: undefined,
    }
  })

  React.useEffect(() => {
    let cancelled = false

    async function loadStaff() {
      const staffId = typeof window !== "undefined" ? window.localStorage.getItem("staffId") : null
      if (!staffId) return

      const access = typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null
      const headers: HeadersInit = { "Content-Type": "application/json" }
      if (access) headers.Authorization = `Bearer ${access}`

      try {
        const response = await fetch(`${API_BASE_URL}/api/staff/${staffId}/`, { headers })
        const data = await response.json().catch(() => ({}))
        if (cancelled || !response.ok || !data) return

        const fullName = `${data.first_name || ""} ${data.last_name || ""}`.trim()
        const initials = `${(data.first_name || "").trim()[0] || ""}${(data.last_name || "").trim()[0] || ""}`

        setUser((prev) => ({
          ...prev,
          name: fullName || data.username || prev.name,
          email: data.email || data.username || prev.email,
          initials: initials ? initials.toUpperCase() : prev.initials,
        }))
      } catch (err) {
        // ignore fetch failures; keep fallback user data
      }
    }

    loadStaff()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link to="/doctor" className="flex items-center gap-2" />}
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <span className="text-base font-semibold">Doctor</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="w-full justify-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-semibold">
                {user.initials || "DR"}
              </div>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="font-medium">{user.name}</span>
                <span className="text-muted-foreground text-xs">{user.email ?? "Signed in"}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
