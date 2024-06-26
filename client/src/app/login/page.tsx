import { FadeIn } from '@/components/FadeIn';
import Login from '@/components/login';
import { ModeToggle } from '@/components/ui/mode-toggle';
import Image from 'next/image';
import React from 'react';

function Page() {
  return (
    <div className="h-screen overflow-hidden md:grid md:grid-cols-2">
      <div className="absolute right-0 top-0 m-4 z-20">
        <ModeToggle />
      </div>
      <FadeIn className="pointer-events-none relative -z-20 h-1/2 w-full md:h-full">
        <div className="absolute bg-gradient-to-t from-transparent via-primary to-transparent h-full w-full" />
        <Image
          src="/images/logo.png"
          alt="Login"
          width={957.61}
          height={836}
          className="absolute bottom-0 left-0 right-0 top-0 m-auto w-1/2"
        />
      </FadeIn>

      <div className="z-10 -mt-32 flex flex-col items-center justify-center md:mt-0 md:grid-cols-1">
        <Login />
      </div>
    </div>
  );
}

export default Page;
