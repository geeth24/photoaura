import AlbumRootPage from '@/components/AlbumRootPage';

async function Page({ params }: { params: Promise<{ user: string; album: string; id: string }> }) {
  return <AlbumRootPage params={await params} />;
}

export default Page;
