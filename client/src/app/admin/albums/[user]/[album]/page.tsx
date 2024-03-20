'use client';
import { useRouter, useParams } from 'next/navigation';
import React from 'react';

function Page() {
  const params = useParams();

  const albumSlug = params.album;
  const userSlug = params.user;

  const slug = `${albumSlug}`;
  const router = useRouter();
  React.useEffect(() => {
    router.push(`/admin/albums/${userSlug}/${slug}/photos`);
  }, []);
}

export default Page;
