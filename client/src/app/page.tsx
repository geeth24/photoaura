'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.push('/admin/dashboard');
  }, [router]);
  return (
    <div className="flex h-screen items-center justify-center">
      <Image src="/images/logo-blue.png" alt="PhotoAura" width={200} height={200} />
    </div>
  );
}
