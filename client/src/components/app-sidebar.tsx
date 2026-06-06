"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  LayoutDashboard,
  Images,
  FolderOpen,
  Users,
  Smile,
  Globe,
  UserCircle,
  Download,
  LogOut,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import Image from "next/image"
import { RadSoftMark } from "@/components/icons"

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, adminOnly: true },
  { title: "Albums", href: "/albums", icon: FolderOpen, adminOnly: false },
  { title: "Photos", href: "/photos", icon: Images, adminOnly: false },
  { title: "Downloads", href: "/downloads", icon: Download, adminOnly: false },
  { title: "Users", href: "/users", icon: Users, adminOnly: true },
  { title: "Faces", href: "/faces", icon: Smile, adminOnly: true },
  { title: "Website", href: "/website", icon: Globe, adminOnly: true },
  { title: "Profile", href: "/profile", icon: UserCircle, adminOnly: false },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const isAdmin = user?.role !== "client"
  const items = navItems.filter((i) => isAdmin || !i.adminOnly)

  // initials for the footer avatar
  const initials = user?.full_name
    ?.split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <Sidebar className="border-r border-border-subtle bg-surface-elevated">
      {/* brand */}
      <SidebarHeader className="border-b border-border-subtle p-6">
        <Link href={isAdmin ? "/dashboard" : "/albums"} className="group flex items-center gap-3">
          <Image src="/images/logo.png" alt="PhotoAura" width={32} height={32} />
          <span className="font-body text-lg font-semibold tracking-tight text-text-primary transition-colors group-hover:text-brand">
            PhotoAura
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-6">
        <SidebarGroup className="p-0">
          {/* eyebrow section label */}
          <div className="mb-4 flex items-center gap-3 px-3">
            <span className="block h-px w-8 bg-brand" />
            <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
              Menu
            </span>
          </div>

          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/")
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      className={`relative h-11 gap-3 px-3 text-[13px] font-body tracking-wide transition-colors data-active:bg-surface-hover data-active:font-medium data-active:text-text-primary ${
                        active
                          ? "text-text-primary"
                          : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
                      }`}
                      render={<Link href={item.href} />}
                    >
                      {active && (
                        <span className="absolute inset-y-0 left-0 w-0.5 bg-brand" />
                      )}
                      <item.icon
                        className={`size-4 transition-colors ${active ? "text-brand" : "text-text-muted group-hover/menu-button:text-text-secondary"}`}
                      />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border-subtle p-4">
        <div className="flex items-center gap-3 px-1 py-1">
          <div className="flex size-9 shrink-0 items-center justify-center bg-brand/10 text-[11px] font-medium uppercase tracking-wider text-brand">
            {initials || "?"}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-medium text-text-primary">
              {user?.full_name}
            </span>
            <span className="truncate text-[11px] text-text-muted">
              {user?.user_email}
            </span>
          </div>
        </div>
        <button
          onClick={logout}
          className="group mt-1 flex w-full items-center gap-3 px-3 py-2.5 text-[12px] font-medium uppercase tracking-[0.15em] text-text-muted transition-colors hover:bg-surface-hover hover:text-brand"
        >
          <LogOut className="size-4 transition-colors group-hover:text-brand" />
          Sign out
        </button>

        <Link
          href="https://radsoftinc.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Built by Rad Soft"
          className="group mt-3 flex items-center justify-center gap-1.5 text-[9px] uppercase tracking-[0.25em] text-text-faint transition-colors hover:text-text-primary"
        >
          <span>Built by</span>
          <RadSoftMark className="size-2.5 text-text-muted transition-colors group-hover:text-brand" />
          <span className="text-text-muted transition-colors group-hover:text-text-primary">
            Rad Soft
          </span>
        </Link>
      </SidebarFooter>
    </Sidebar>
  )
}
