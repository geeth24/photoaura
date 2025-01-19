import PhotoModalPage from '@/components/PhotoModalPage';
import React from 'react';

async function Page({ params }: { params: Promise<{ user: string; album: string; id: string }> }) {
  return <PhotoModalPage params={await params} />;
}

export default Page;
