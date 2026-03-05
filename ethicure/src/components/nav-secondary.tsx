"use client"

import * as React from "react"
import { type Icon } from "@tabler/icons-react"
import { useLocation, useNavigate } from "react-router-dom"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { clearAuth } from "@/lib/utils"

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: Icon
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (url: string) =>
    url === "/"
      ? location.pathname === "/"
      : location.pathname === url || location.pathname.startsWith(`${url}/`)

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                isActive={isActive(item.url)}
                aria-current={isActive(item.url) ? "page" : undefined}
                className="flex w-full items-center gap-2"
                type="button"
                onClick={() => {
                  if (item.url === "/logout") {
                    clearAuth()
                    navigate("/login")
                    return
                  }
                  navigate(item.url)
                }}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
