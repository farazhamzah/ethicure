"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

function buildInitials(name?: string, email?: string) {
  const source = (name || email || "").trim()
  if (!source) return "??"

  const parts = source
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }

  const single = parts[0] || source[0]
  return (single ? single.slice(0, 2) : "??").toUpperCase()
}

export function NavUser({
  user,
}: {
  user: {
    name: string
    email?: string
    avatar?: string
    initials?: string
  }
}) {
  const initials = user.initials || buildInitials(user.name, user.email)
  const email = user.email || "Signed in"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          render={<div className="flex w-full items-center gap-3" />}
          className="w-full justify-start gap-3 cursor-default"
        >
          <Avatar className="h-8 w-8 rounded-lg grayscale">
            <AvatarImage src={user.avatar || undefined} alt={user.name} />
            <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
            <span className="font-medium">{user.name}</span>
            <span className="text-muted-foreground text-xs">{email}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
