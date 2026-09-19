import { AuthProvider } from "@/context/auth-context"
import { Shell } from "@/components/shell"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  )
}
