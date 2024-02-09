import SharedPage from '@/components/SharedPage';
import { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: { user: string; album: string, secret: string  };
}): Promise<Metadata> {
  const response = await fetch(
    `https://aura.reactiveshots.com/api/album/${params.user}/${params.album}/`,
  );
  const result = await response.json();

  return {
    title: `${result.album_name} | PhotoAura`,
    description: `View ${result.album_name} on PhotoAura`,
    openGraph: {
      images: [
        {
          url: result.album_photos[0].image,
        },
      ],
    },
  };
}

function Page({ params }: { params: { user: string; album: string, secret: string } }) {
  return <SharedPage params={params} />;
}

export default Page;
