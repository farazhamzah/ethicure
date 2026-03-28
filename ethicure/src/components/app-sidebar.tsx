"use client"

import * as React from "react"
import {
  IconBell,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconDevices2,
  IconFileAi,
  IconLogout,
  IconReport,
  IconSettings,
} from "@tabler/icons-react"
import { Link } from "react-router-dom"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { getPatientProfile } from "@/lib/api"
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
    title: "Dashboard",
    url: "/",
    icon: IconDashboard,
    exact: true,
  },
  {
    title: "Devices",
    url: "/devices",
    icon: IconDevices2,
  },
  {
    title: "Reports",
    url: "/reports",
    icon: IconReport,
  },
  {
    title: "Your Data",
    url: "/your-data",
    icon: IconDatabase,
  },
  {
    title: "Goals & Limits",
    url: "/goals-limits",
    icon: IconChartBar,
  },
  {
    title: "AI Assistant",
    url: "/ai-assistant",
    icon: IconFileAi,
  },
]

const navSecondary = [
  {
    title: "Notifications",
    url: "/notifications",
    icon: IconBell,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: IconSettings,
  },
  {
    title: "Logout",
    url: "/logout",
    icon: IconLogout,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user, setUser] = React.useState<SidebarUser>(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("username") : null
    const name = stored || "Patient"
    return {
      name,
      email: stored || undefined,
      avatar: undefined,
    }
  })

  React.useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      try {
        const profile = await getPatientProfile()
        if (cancelled || !profile) return

        const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
        const initials = `${(profile.first_name || "").trim()[0] || ""}${(profile.last_name || "").trim()[0] || ""}`

        setUser((prev) => ({
          ...prev,
          name: fullName || profile.username || prev.name,
          email: profile.email || profile.username || prev.email,
          initials: initials ? initials.toUpperCase() : prev.initials,
        }))

        if (typeof window !== "undefined") {
          try {
            if (profile.id) window.localStorage.setItem("patientId", String(profile.id))
            if (profile.username) window.localStorage.setItem("username", profile.username)
          } catch (err) {
            // ignore localStorage write failures
          }
        }
      } catch (err) {
        // ignore fetch failures; fallback user state will remain
      }
    }

    loadProfile()
    return () => {
      cancelled = true
    }
  }, [])

  const patientNavItemClassName =
    "hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground data-active:bg-primary data-active:text-primary-foreground"

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link to="/" className="flex items-center gap-2" />}
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <span className="text-base font-semibold">Ethicare</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={navMain}
          showQuickActions={false}
          itemClassName={patientNavItemClassName}
        />
        <NavSecondary
          items={navSecondary}
          itemClassName={patientNavItemClassName}
          className="mt-auto"
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
