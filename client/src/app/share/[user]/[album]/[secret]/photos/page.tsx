import { AlbumGrid } from '@/components/AlbumPage';
import SharedPage from '@/components/SharedPage';
import { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ user: string; album: string; secret: string }>;
}): Promise<Metadata> {
  const { user, album, secret } = await params;
  const dev = process.env.NEXT_PUBLIC_API_URL?.includes('localhost');

  if (dev) {
    return {
      title: `${album} | PhotoAura`,
      description: `View ${album} on PhotoAura`,
      openGraph: {
        images: [
          {
            url: 'https://aura.reactiveshots.com/images/Logo-Banner.png',
          },
        ],
      },
    };
  }

  const response = await fetch(`http://aura-api.reactiveshots.com/api/album/${user}/${album}/`);
  const result: AlbumGrid = await response.json();

  return {
    title: `${result.album_name} | PhotoAura`,
    description: `View ${result.album_name} on PhotoAura`,
    openGraph: {
      images: [
        {
          url: result.album_photos[0].compressed_image.split('?')[0],
        },
      ],
    },
  };
}

async function Page({
  params,
}: {
  params: Promise<{ user: string; album: string; secret: string }>;
}) {
  const { user, album, secret } = await params;
  const albumData: AlbumGrid = await getAlbum(user, album, secret);
  return (
    <>
      <meta
        name="apple-itunes-app"
        content={`app-id=6477320360, app-argument=photoaura://?url=aura-api.reactiveshots.com&shareLink=${user}/${album}/${secret}`}
      />
      <SharedPage params={{ user, album, secret }} albumData={albumData} />
    </>
  );
}

export default Page;

// Server-side fetching functions with token parameter
async function getAlbum(userSlug: string, albumSlug: string, secret: string): Promise<AlbumGrid> {
  const response = await fetch(
    `${process.env.API_URL}/album/${userSlug}/${albumSlug}/?secret=${secret}`,
    {
      cache: 'no-cache',
    },
  );

  if (!response.ok) {
    throw new Error('Failed to fetch album data');
  }

  return response.json();
}
