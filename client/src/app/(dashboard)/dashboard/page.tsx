"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/context/auth-context"
import { apiFetch } from "@/lib/api"
import type { DashboardStats } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { FolderOpen, Users, Images } from "lucide-react"

const statCards = [
  { key: "albums" as const, label: "Albums", icon: FolderOpen },
  { key: "users" as const, label: "Users", icon: Users },
  { key: "photos" as const, label: "Photos", icon: Images },
]

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    apiFetch<DashboardStats>("/dashboard/")
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [user])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map(({ key, label, icon: Icon }) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
              <Icon className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-9 w-20" />
              ) : (
                <p className="text-3xl font-bold tracking-tight">
                  {stats?.[key]?.toLocaleString() ?? "—"}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
