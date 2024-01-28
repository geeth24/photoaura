'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { useRouter, useSearchParams } from 'next/navigation';
import { Album } from '@/components/PhotosGrid';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { ModeToggle } from '@/components/ui/mode-toggle';

interface AlbumGrid {
  album_name: string;
  image_count: number;
  shared: boolean;
  album_photos: Album[];
}

function Page() {
  const [socketMessages, setSocketMessages] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [albumName, setAlbumName] = useState<string>('test'); // Replace 'test' with the variable holding the actual album name if necessary
  const [albums, setAlbums] = useState<AlbumGrid[]>([]);
  const { sidebarOpened } = useAuth();

  const getAlbums = async () => {
    console.log('Getting albums');
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/albums`);
    const data = await response.json();
    console.log(data);
    setAlbums(data);
  };

  const router = useRouter();
  const searchParams = useSearchParams();

  const album_updated = searchParams.get('album_updated');
  useEffect(() => {
    if (album_updated) {
      //reversh the page to remove the query param
      router.push('/admin/albums');
    }

    getAlbums();
  }, [router, album_updated]);

  // Function to handle file selection
  const handleFileSelect = (files: FileList | null) => {
    setSelectedFiles(files);
  };

  const handleFileUpload = async () => {
    if (!selectedFiles) return;

    setUploading(true);
    // Connect to WebSocket
    const newSocket = new WebSocket(`wss://photoaura-api.reactiveshots.com/ws`);

    newSocket.onmessage = (event) => {
      console.log('Message from server:', event.data);
      setSocketMessages((prevMessages) => [...prevMessages, event.data]);
    };

    const formData = new FormData();

    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append('files', selectedFiles[i]);
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/upload-files/?album_name=${encodeURIComponent(albumName)}`,
      {
        method: 'POST',
        body: formData,
      },
    );

    const result = await response.json();
    console.log(result);

    // Disconnect from WebSocket
    if (newSocket.readyState === 1) {
      newSocket.close();
    }
    setUploading(false);
    getAlbums();
    router.push(`/admin/albums/${encodeURIComponent(albumName)}`);
  };

  return (
    <div
      className={`flex flex-col items-center justify-center ${sidebarOpened ? 'pl-4' : ''} pr-4`}
    >
      <Drawer>
        <div className="mt-4 flex w-full items-end justify-end">
          <div className="flex space-x-2">
            <DrawerTrigger asChild>
              <Button className="">New Album</Button>
            </DrawerTrigger>
            <ModeToggle />
          </div>
        </div>
        <DrawerContent
          className={`ml-auto w-full ${sidebarOpened ? 'md:pl-16' : 'pl-[21%]'} transition-all duration-500`}
        >
          <DrawerHeader>
            <DrawerTitle>New Album</DrawerTitle>
            <div className="mt-4">
              <Label>Upload Images</Label>
              <Input
                type="file"
                multiple
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleFileSelect(e.target.files)
                }
                accept=".png,.jpg,.jpeg"
              />
            </div>

            <div className="mt-2">
              {socketMessages.length === 0 ? (
                <>
                  <Label>Album Name</Label>
                  <Input value={albumName} onChange={(e) => setAlbumName(e.target.value)} />
                </>
              ) : (
                <div>{socketMessages.length} files uploaded.</div>
              )}
              {uploading && (
                <div>
                  <h1 className="text-center">
                    {socketMessages.length} / {selectedFiles?.length} files uploaded.
                  </h1>
                  <Progress value={(socketMessages.length / (selectedFiles?.length ?? 1)) * 100} />
                </div>
              )}
            </div>
          </DrawerHeader>
          <DrawerFooter>
            <Button
              onClick={handleFileUpload}
              disabled={uploading || !selectedFiles || selectedFiles.length === 0}
            >
              Upload
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      <div className="mt-4 grid w-full grid-cols-1  gap-4 p-4  md:grid-cols-2 lg:grid-cols-3">
        {albums.map((album) => (
          <Link
            href={`/admin/albums/${encodeURIComponent(album.album_name)}`}
            key={album.album_name}
            className="h-full w-full"
          >
            <Card className="h-full w-full p-4">
              <CardHeader>
                <CardTitle>{album.album_name}</CardTitle>
                <CardDescription>{album.image_count} images</CardDescription>
                {album.shared ? (
                  <CardDescription className="text-primary">Shared</CardDescription>
                ) : (
                  <CardDescription className="text-primary">Private</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {album.album_photos.map((photo) => (
                    <div key={photo.image}>
                      <AspectRatio ratio={1}>
                        <Image
                          src={photo.image}
                          width={500}
                          height={500}
                          className="h-full w-full rounded-md object-cover"
                          alt={'image'}
                          placeholder="blur"
                          blurDataURL={photo.file_metadata.blur_data_url}
                          priority
                        />
                      </AspectRatio>
                    </div>
                  ))}
                </div>
              </CardContent>
              {/* <CardFooter>
              <Button className="mt-4 w-full" onClick={() => deleteAlbum(album.album_name)}>
                Delete
              </Button>
            </CardFooter> */}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default Page;
