import PhotosModalPage from '@/components/PhotosModalPage';
import React from 'react';

async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <PhotosModalPage params={await params} />;
}

export default Page;
