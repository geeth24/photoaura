import { AuthProvider } from "@/context/auth-context"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
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
    </AuthProvider>
  )
}
