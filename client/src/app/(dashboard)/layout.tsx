import { AuthProvider } from "@/context/auth-context"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border-subtle bg-surface/80 px-6 backdrop-blur-xl">
            <SidebarTrigger className="-ml-1 text-text-muted hover:text-text-primary" />
            <span className="h-4 w-px shrink-0 bg-border-subtle" />
            <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-text-muted">
              Studio
            </span>
          </header>
          <main className="flex-1 p-8">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  )
}
