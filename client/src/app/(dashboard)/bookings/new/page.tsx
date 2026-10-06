"use client"

import { useDocumentTitle } from "@/lib/use-document-title"
import { BookingForm } from "@/components/booking-form"

export default function NewBookingPage() {
  useDocumentTitle("New booking")
  return <BookingForm />
}
