"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { bookingsApi } from "@/lib/api"
import type { Booking } from "@/lib/types"
import { useDocumentTitle } from "@/lib/use-document-title"
import { Skeleton } from "@/components/ui/skeleton"
import { BookingForm } from "@/components/booking-form"

export default function EditBookingPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params)
  useDocumentTitle(`Edit ${number}`)
  const [booking, setBooking] = useState<Booking | null | undefined>(undefined)

  useEffect(() => {
    bookingsApi
      .get(number)
      .then(setBooking)
      .catch(() => setBooking(null))
  }, [number])

  if (booking === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }
  if (!booking) {
    return (
      <div className="border border-dashed border-border-default py-16 text-center">
        <p className="font-heading text-xl text-text-primary">Booking not found</p>
        <Link href="/bookings" className="mt-3 inline-block text-sm text-brand hover:underline">
          Back to bookings
        </Link>
      </div>
    )
  }
  return <BookingForm initial={booking} />
}
