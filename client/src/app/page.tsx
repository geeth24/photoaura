'use client';

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  router.push('/admin/albums');
  return (
    <div>
      <h1>PhotoAura</h1>
    </div>
  );
}
