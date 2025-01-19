import SharePhotoModalPage from '@/components/ShareModalPage';
import React from 'react';

async function Page({ params }: { params: Promise<{ user: string; album: string; secret: string; id: string }> }) {
  return <SharePhotoModalPage params={await params} />;
}

export default Page;