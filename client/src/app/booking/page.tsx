import { Suspense } from 'react';
import BookingForm from '@/components/BookingForm';

export const metadata = {
  title: 'Book a Session - PhotoAura',
  description: 'Schedule your photography session with PhotoAura',
};

export default function BookingPage() {
  return (
    <div className="container mx-auto max-w-3xl py-10">
      <h1 className="mb-6 text-3xl font-bold">Book a Photography Session</h1>
      <p className="mb-8 text-muted-foreground">
        Please fill out the form below to schedule your photography session. We will get back to you
        to confirm your booking.
      </p>
      <Suspense fallback={<div>Loading...</div>}>
        <BookingForm />
      </Suspense>
    </div>
  );
}
