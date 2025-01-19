'use client';

import { redirect } from 'next/navigation';

async function Page({
  params,
}: {
  params: Promise<{ user: string; album: string; secret: string }>;
}) {
  const { user, album, secret } = await params;
  redirect(`/share/${user}/${album}/${secret}/photos`);
}

export default Page;
