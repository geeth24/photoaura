'use client';
import { Album } from '@/components/PhotosGrid';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Pencil1Icon } from '@radix-ui/react-icons';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { getCookie } from 'cookies-next';

type Face = {
  id: string;
  name: string;
  external_id: string;
  face_photos: Album[];
};

type Params = {
  id: string;
};

function FacePage({ params: { id } }: { params: Params }) {
  const [face, setFace] = useState<Face>({
    id: '',
    name: '',
    external_id: '',
    face_photos: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getFace = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/face/${id}`, {
        headers: {
          Authorization: `Bearer ${getCookie('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = await response.json();
      setFace(data);
    } catch (err) {
      console.error('Error fetching face:', err);
      setError('Failed to load face details. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const updateFace = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/face/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getCookie('token')}`,
        },
        body: JSON.stringify(face),
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      getFace();
    } catch (err) {
      console.error('Error updating face:', err);
      setError('Failed to update face. Please try again.');
    }
  };

  useEffect(() => {
    getFace();
  }, []);

  const { sidebarOpened } = useAuth();
  
  return (
    <div
      className={`flex flex-col items-center justify-center ${sidebarOpened ? 'pl-4' : ''} pr-4`}
    >
      <div className="z-20 mt-4 flex w-full items-center justify-between">
        <h1 className="text-2xl font-bold">{face.name || 'Face Details'}</h1>
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon">
              <Pencil1Icon className="h-[1.2rem] w-[1.2rem]" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Edit Face</SheetTitle>
            </SheetHeader>
            <SheetDescription>
              <p>Change the name of the face</p>
            </SheetDescription>
            <div className="mt-4 flex flex-col space-y-4">
              <Label htmlFor="name">Name</Label>
              <Input
                type="text"
                value={face.name}
                onChange={(e) => setFace({ ...face, name: e.target.value })}
              />
            </div>
            <SheetClose asChild>
              <div className="mt-4 flex">
                <Button className="w-full" onClick={updateFace}>
                  Update
                </Button>
              </div>
            </SheetClose>
          </SheetContent>
        </Sheet>
      </div>

      {error && <div className="mt-4 w-full rounded-md bg-red-50 p-4 text-red-600">{error}</div>}

      {loading ? (
        <div className="mt-4 flex w-full justify-center">
          <div className="text-center">Loading face details...</div>
        </div>
      ) : (
        <div className="mt-4 columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4">
          {face.face_photos && face.face_photos.length > 0 ? (
            face.face_photos.map((photo) => (
              <div
                key={photo.image}
                className="after:content after:shadow-highlight group relative mb-5 block w-full cursor-pointer after:pointer-events-none after:absolute after:inset-0 after:rounded-lg"
              >
                <Image
                  src={photo.compressed_image}
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
              </div>
            ))
          ) : (
            <div className="w-full text-center">No photos found for this face</div>
          )}
        </div>
      )}
    </div>
  );
}

export default FacePage;
