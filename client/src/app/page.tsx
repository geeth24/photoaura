'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Header from '@/components/Header';

export default function Home() {
  return (
    <>
      <Header />
      <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="mb-10">
          <Image
            src="/images/logo-blue.png"
            alt="PhotoAura"
            width={200}
            height={200}
            className="mx-auto"
          />
          <h1 className="mt-6 font-blackmud text-4xl md:text-5xl">Welcome to PhotoAura</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Capture your most precious moments with professional photography services.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/booking">Book a Session</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Client Login</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
