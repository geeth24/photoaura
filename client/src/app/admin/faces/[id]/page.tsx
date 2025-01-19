import FacePage from '@/components/FacePage';
import React from 'react';

async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <FacePage params={await params} />;
}

export default Page;
