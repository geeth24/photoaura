import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import { Button } from './ui/button';
import { ModeToggle } from './ui/mode-toggle';

function Navbar() {
  return (
    <div className="fixed top-0 z-10 w-full p-6">
      <div className="flex w-full justify-between">
        <div className="flex items-center space-x-6">
          <Link className="flex items-center space-x-4" href="/">
            <Image
              src="/logo-color.png"
              alt="Your Company"
              width={100}
              height={100}
              className="h-11 w-11"
            />
            <span className="text-2xl font-bold">PhotoAura</span>
          </Link>
          <div className="flex space-x-4">
            <Button asChild variant="ghost">
              <Link href="/policy">Privacy Policy</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="mailto:info@radsoftinc.com">Contact</Link>
            </Button>
          </div>
        </div>
        <ModeToggle />
      </div>
    </div>
  );
}

export default Navbar;
