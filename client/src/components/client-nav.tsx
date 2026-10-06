"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarCheck, House, Images, ReceiptText, UserCircle } from "lucide-react"
import { bookingsApi } from "@/lib/api"
import { cn } from "@/lib/utils"

type NavItem = {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  active: (path: string) => boolean
}

const HOME: NavItem = { title: "Home", href: "/albums", icon: House, active: (p) => p === "/albums" }
// an open gallery is still "Galleries", even though it lives under /albums
const GALLERIES: NavItem = {
  title: "Galleries",
  href: "/galleries",
  icon: Images,
  active: (p) => p.startsWith("/galleries") || p.startsWith("/albums/"),
}
const BOOKINGS: NavItem = {
  title: "Bookings",
  href: "/bookings",
  icon: CalendarCheck,
  active: (p) => p.startsWith("/bookings"),
}
const INVOICES: NavItem = {
  title: "Invoices",
  href: "/invoices",
  icon: ReceiptText,
  active: (p) => p.startsWith("/invoices"),
}
const PROFILE: NavItem = { title: "Profile", href: "/profile", icon: UserCircle, active: (p) => p.startsWith("/profile") }

// bookings and invoices only show up once the studio has sent one
function useHasBookings(pathname: string) {
  const [has, setHas] = useState(false)
  useEffect(() => {
    if (has) return
    let live = true
    bookingsApi
      .mine()
      .then((rows) => live && setHas(rows.length > 0))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [pathname, has])
  return has
}

export function useClientNav() {
  const pathname = usePathname()
  const hasBookings = useHasBookings(pathname)
  const items = [HOME, GALLERIES, ...(hasBookings ? [BOOKINGS, INVOICES] : []), PROFILE]
  return { items, pathname }
}

// desktop: a row of links in the top bar; profile stays an icon on the right
export function ClientTopNav({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <nav className="hidden h-full items-stretch md:flex">
      {items
        .filter((i) => i !== PROFILE)
        .map((item) => {
          const active = item.active(pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center px-3.5 text-[10px] font-medium uppercase tracking-[0.25em] transition-colors lg:px-4",
                active ? "text-text-primary" : "text-text-muted hover:text-text-primary",
              )}
            >
              {item.title}
              {active && <span className="absolute inset-x-3.5 -bottom-px h-px bg-brand lg:inset-x-4" />}
            </Link>
          )
        })}
    </nav>
  )
}

export function ProfileLink({ pathname }: { pathname: string }) {
  const active = PROFILE.active(pathname)
  return (
    <Link
      href={PROFILE.href}
      aria-label="Profile"
      aria-current={active ? "page" : undefined}
      className={cn(
        "hidden size-9 items-center justify-center transition-colors md:flex",
        active ? "text-brand" : "text-text-muted hover:text-text-primary",
      )}
    >
      <UserCircle className="size-[18px]" />
    </Link>
  )
}

// phones: a bottom tab bar, like the iOS and Android apps
export function ClientTabBar({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-lg">
        {items.map((item) => {
          const active = item.active(pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1.5 transition-colors",
                active ? "text-brand" : "text-text-muted active:text-text-primary",
              )}
            >
              {active && <span className="absolute inset-x-5 top-0 h-0.5 bg-brand" />}
              <item.icon className="size-[19px]" />
              <span className="text-[9px] font-medium uppercase tracking-[0.18em]">{item.title}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
