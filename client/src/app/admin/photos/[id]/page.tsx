'use client';
import { useRouter } from 'next/navigation';
import React from 'react';

export default function PhotoPage({ params: { id } }: { params: { id: string } }) {
  const router = useRouter();
  React.useEffect(() => {
    router.push('/admin/photos');
  }, []);
}
