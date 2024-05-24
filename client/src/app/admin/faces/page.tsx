'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { AspectRatio } from '@radix-ui/react-aspect-ratio';
import Link from 'next/link';
type Face = {
  id: string;
  name: string;
  external_id: string;
  image_url: string;
};

function Page() {
  const [faces, setFaces] = useState<Face[]>([]);

  const getFaces = async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/faces`);
    const data = await response.json();
    setFaces(data);
  };

  React.useEffect(() => {
    getFaces();
  }, []);

  const { sidebarOpened } = useAuth();
  return (
    <div
      className={`flex flex-col items-center justify-center ${sidebarOpened ? 'pl-4' : ''} pr-4`}
    >
      <div className="z-20 mt-4 flex w-full items-center">
        <h1 className="text-2xl font-bold">Faces</h1>
      </div>
      <div className="mt-4 columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4">
        {faces.map((face) => (
          <Link
            href={`/admin/faces/${face.external_id}`}
            key={face.id}
            className="after:content after:shadow-highlight group relative mb-5 block w-full cursor-pointer after:pointer-events-none after:absolute after:inset-0 after:rounded-lg"
          >
            <Image
              src={face.image_url}
              width={720}
              height={480}
              style={{ transform: 'translate3d(0, 0, 0)' }}
              sizes="(max-width: 640px) 100vw,
                  (max-width: 1280px) 50vw,
                  (max-width: 1536px) 33vw,
                  25vw"
              alt="Photo"
              className="transform rounded-lg brightness-90 transition will-change-auto group-hover:brightness-110"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default Page;
