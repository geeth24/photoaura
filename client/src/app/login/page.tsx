import { FadeIn } from '@/components/FadeIn';
import Login from '@/components/login';
import { ModeToggle } from '@/components/ui/mode-toggle';
import Image from 'next/image';
import React from 'react';

function Page() {
  return (
    <div className="h-screen md:grid md:grid-cols-2">
      <div className="absolute right-0 top-0 m-4">
        <ModeToggle />
      </div>
      <FadeIn className="-z-20 pointer-events-none relative h-1/2 w-full md:h-full">
        <Image
          src="/images/login.png"
          alt="Login"
          width={1440}
          height={1024}
          className="h-full w-full object-cover blur-3xl"
        />
        <Image
          src="/images/logo.png"
          alt="Login"
          width={957.61}
          height={836}
          className="absolute bottom-0 left-0 right-0 top-0 m-auto w-1/2"
        />
      </FadeIn>

      <div className="-mt-32 md:mt-0 z-10 flex flex-col items-center justify-center md:grid-cols-1">
        <Login />
      </div>
    </div>
  );
}

export default Page;
