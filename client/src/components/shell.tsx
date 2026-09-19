"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { LogOut, UserCircle } from "lucide-react"

// clients get a quiet top bar; the studio keeps its sidebar
export function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.role === "client") return <ClientShell>{children}</ClientShell>
  return <StudioShell>{children}</StudioShell>
}

function StudioShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border-subtle bg-surface/80 px-6 backdrop-blur-xl">
          <SidebarTrigger className="-ml-1 text-text-muted hover:text-text-primary" />
          <span className="h-4 w-px shrink-0 bg-border-subtle" />
          <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
            Studio
          </span>
        </header>
        {/* min-w-0 lets this flex child shrink to the viewport so a wide
            child (the photo masonry) can't push the page past the edge */}
        <main className="min-w-0 flex-1 overflow-x-hidden p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function ClientShell({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth()
  const pathname = usePathname()
  const onProfile = pathname.startsWith("/profile")

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-surface/80 px-5 backdrop-blur-xl sm:px-8">
        <Link href="/albums" className="flex items-center gap-2.5">
          <Image src="/images/logo.png" alt="" width={26} height={26} />
          <span className="text-[11px] font-medium uppercase tracking-[0.3em] text-text-primary">
            PhotoAura
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/profile"
            aria-label="Profile"
            className={`flex size-9 items-center justify-center transition-colors ${
              onProfile ? "text-brand" : "text-text-muted hover:text-text-primary"
            }`}
          >
            <UserCircle className="size-[18px]" />
          </Link>
          <button
            onClick={logout}
            aria-label="Sign out"
            className="flex size-9 items-center justify-center text-text-muted transition-colors hover:text-text-primary"
          >
            <LogOut className="size-[17px]" />
          </button>
        </nav>
      </header>
      <main className="min-w-0 flex-1 overflow-x-hidden px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  )
}
