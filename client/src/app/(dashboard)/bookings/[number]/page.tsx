"use client"

import { use } from "react"
import { useAuth } from "@/context/auth-context"
import { BookingDetail } from "@/components/booking-detail"
import { ClientBooking } from "@/components/client-booking"

export default function BookingPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params)
  const { user } = useAuth()
  if (!user) return null
  return user.role === "client" ? <ClientBooking number={number} /> : <BookingDetail number={number} />
}
