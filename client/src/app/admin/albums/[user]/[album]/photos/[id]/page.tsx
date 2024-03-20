'use client';
import { useParams, useRouter } from 'next/navigation';
import React from 'react';

export default function PhotoPage({ params: { id } }: { params: { id: string } }) {
  const router = useRouter();
  const urlParams = useParams();

  React.useEffect(() => {
    router.push(`/admin/albums/${urlParams.user}/${urlParams.album}/photos`);
  }, []);
}
