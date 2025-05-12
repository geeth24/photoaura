'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { getCookie } from 'cookies-next';
type Face = {
  id: string;
  name: string;
  external_id: string;
  image_url: string;
};

function Page() {
  const [faces, setFaces] = useState<Face[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { accessToken, sidebarOpened } = useAuth();

  const getFaces = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/faces`, {
        headers: {
          Authorization: `Bearer ${getCookie('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = await response.json();
      setFaces(data);
    } catch (err) {
      console.error('Error fetching faces:', err);
      setError('Failed to load faces. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    getFaces();
  }, [accessToken]);

  return (
    <div
      className={`flex flex-col items-center justify-center ${sidebarOpened ? 'pl-4' : ''} pr-4`}
    >
      <div className="z-20 mt-4 flex w-full items-center">
        <h1 className="text-2xl font-bold">Faces</h1>
      </div>

      {error && <div className="mt-4 w-full rounded-md bg-red-50 p-4 text-red-600">{error}</div>}

      {loading ? (
        <div className="mt-4 flex w-full justify-center">
          <div className="text-center">Loading faces...</div>
        </div>
      ) : (
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
                alt={face.name || 'Face'}
                className="transform rounded-lg brightness-90 transition will-change-auto group-hover:brightness-110"
              />
              {face.name && (
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2 text-center text-white">
                  {face.name}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default Page;
