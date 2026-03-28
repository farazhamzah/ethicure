"use client"

import * as React from "react"
import { IconDashboard, IconLogout } from "@tabler/icons-react"
import { Link } from "react-router-dom"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { getPatientProfile, getStaffDetail } from "@/lib/api"
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
    title: "Admin Home",
    url: "/admin",
    icon: IconDashboard,
    exact: true,
  },
]

const navSecondary = [
  {
    title: "Logout",
    url: "/logout",
    icon: IconLogout,
  },
]

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user, setUser] = React.useState<SidebarUser>(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("username") : null
    const name = stored || "Admin"
    return {
      name,
      email: stored || undefined,
      avatar: undefined,
    }
  })

  React.useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      // Prefer staff profile when we have a staff id (admin/doctor login).
      const staffIdRaw = typeof window !== "undefined" ? window.localStorage.getItem("staffId") : null
      const staffId = staffIdRaw ? Number(staffIdRaw) : NaN
      const authRole = typeof window !== "undefined" ? window.localStorage.getItem("authRole") : null

      if (!Number.isNaN(staffId) && staffId > 0) {
        try {
          const staff = await getStaffDetail(staffId)
          if (!cancelled && staff) {
            const fullName = `${staff.first_name || ""} ${staff.last_name || ""}`.trim()
            const initials = `${(staff.first_name || "").trim()[0] || ""}${(staff.last_name || "").trim()[0] || ""}`

            setUser((prev) => ({
              ...prev,
              name: fullName || staff.username || prev.name,
              email: staff.email || staff.username || prev.email,
              initials: initials ? initials.toUpperCase() : prev.initials,
            }))

            if (typeof window !== "undefined") {
              try {
                if (staff.username) window.localStorage.setItem("username", staff.username)
                window.localStorage.setItem("staffId", String(staff.id))
              } catch (err) {
                // ignore localStorage write failures
              }
            }

            return
          }
        } catch (err) {
          // fall back to patient profile below only for patient sessions
        }

        // If a staff id is present, avoid hitting patient-only profile endpoint.
        return
      }

      // In admin/doctor sessions, patient profile endpoint is expected to return 403.
      if (authRole === "admin" || authRole === "doctor") {
        return
      }

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

  const adminNavItemClassName =
    "hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground data-active:bg-primary data-active:text-primary-foreground"

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link to="/admin" className="flex items-center gap-2" />}
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <span className="text-base font-semibold">Admin</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={navMain}
          showQuickActions={false}
          itemClassName={adminNavItemClassName}
        />
        <NavSecondary
          items={navSecondary}
          itemClassName={adminNavItemClassName}
          className="mt-auto"
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
