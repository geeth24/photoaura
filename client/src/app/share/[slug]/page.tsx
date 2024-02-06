import SharedPage from '@/components/SharedPage';
import { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/album/${params.slug}/`);
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

function Page({ params }: { params: { slug: string } }) {
  return <SharedPage params={params} />;
}

export default Page;
