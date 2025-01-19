'use client';
import { useRouter } from 'next/navigation';
import React from 'react';

type Params = {
  user: string;
  album: string;
  id: string;
};
export default function PhotoModalPage({ params }: { params: Params }) {
  const router = useRouter();

  React.useEffect(() => {
    router.push(`/admin/albums/${params.user}/${params.album}/photos`);
  }, []);

  return null;
}
