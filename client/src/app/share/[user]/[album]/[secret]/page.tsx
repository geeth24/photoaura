'use client';
import SharedPage from '@/components/SharedPage';
import { Metadata } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function Page({ params }: { params: { user: string; album: string; secret: string } }) {
  const router = useRouter();
  useEffect(() => {
    router.push(`/share/${params.user}/${params.album}/${params.secret}/photos`);
  }, []);
}

export default Page;
