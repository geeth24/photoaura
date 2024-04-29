import { AlbumGrid } from '@/app/admin/albums/[user]/[album]/photos/page';
import SharedPage from '@/components/SharedPage';
import { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: { user: string; album: string; secret: string };
}): Promise<Metadata> {
  const dev = process.env.NEXT_PUBLIC_API_URL?.includes('localhost');
  if (dev) {
    return {
      title: `${params.album} | PhotoAura`,
      description: `View ${params.album} on PhotoAura`,
      openGraph: {
        images: [
          {
            url: 'https://aura.reactiveshots.com/images/Logo-Banner.png',
          },
        ],
      },
    };
  }

  const response = await fetch(
    `http://aura-api.reactiveshots.com/api/album/${params.user}/${params.album}/`,
  );
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

function Page({ params }: { params: { user: string; album: string; secret: string } }) {
  return (
    <>
      <meta
        name="apple-itunes-app"
        content={`app-id=6477320360, app-argument=photoaura://?url=aura.reactiveshots.com&shareLink=${params.user}/${params.album}/${params.secret}`}
      />
      <SharedPage params={params} />
    </>
  );
}

export default Page;
