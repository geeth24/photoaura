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
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { showToastWithCooldown } from '@/components/ToastCooldown';
import { FadeIn, FadeInStagger } from '@/components/FadeIn';
import { Switch } from '@/components/ui/switch';
import { getCookie } from 'cookies-next';

interface AlbumGrid {
  album_name: string;
  slug: string;
  image_count: number;
  shared: boolean;
  album_photos: Album[];
}

type SocketMessage = {
  upload_bytes: number;
  total_bytes: number;
};

type AlbumPageProps = {
  albumsData: AlbumGrid[];
};
function AlbumsPage({ albumsData }: AlbumPageProps) {
  const [socketMessages, setSocketMessages] = useState<SocketMessage>({
    upload_bytes: 0,
    total_bytes: 0,
  });

  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [albumName, setAlbumName] = useState<string>('test'); // Replace 'test' with the variable holding the actual album name if necessary
  const [albums, setAlbums] = useState<AlbumGrid[]>(albumsData);
  const { sidebarOpened, user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  const getAlbums = async () => {
    setIsLoading(true);
    // console.log('Getting albums');
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/albums/?user_id=${user?.id}`, {
      headers: {
        Authorization: `Bearer ${getCookie('token')}`,
      },
    });
    const data = await response.json();

    if (data.length === 0) {
      setIsLoading(false);
      showToastWithCooldown('No albums found', false);
      return;
    }
    // console.log(data);
    setAlbums(data);
    setIsLoading(false);
    showToastWithCooldown('Albums loaded', true);
  };

  const router = useRouter();
  const searchParams = useSearchParams();

  const album_updated = searchParams.get('album_updated');
  useEffect(() => {
    if (album_updated) {
      //reversh the page to remove the query param
      router.push('/admin/albums');
    }
  }, [router, album_updated]);

  // Function to handle file selection
  const handleFileSelect = (files: FileList | null) => {
    setSelectedFiles(files);
  };

  const handleFileUpload = async () => {
    if (!selectedFiles) return;

    setUploading(true);
    // Connect to WebSocket
    const newSocket = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/ws/`);

    newSocket.onmessage = (event) => {
      console.log('Message from server:', event.data);
      setSocketMessages(JSON.parse(event.data));
    };

    const formData = new FormData();

    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append('files', selectedFiles[i]);
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/upload-files/?album_name=${encodeURIComponent(albumName)}&user_id=${user?.id}&face_detection=${faceDetection}`,
      {
        headers: {
          Authorization: `Bearer ${getCookie('token')}`,
        },
        method: 'POST',
        body: formData,
      },
    );

    const result = await response.json();
    // console.log(result);

    // Disconnect from WebSocket
    if (newSocket.readyState === 1) {
      newSocket.close();
    }
    setUploading(false);
    getAlbums();
    //if response is 200, show success toast
    if (response.status === 200) {
      showToastWithCooldown('Files uploaded', true);
      router.push(`/admin/albums/${user?.user_name}/${albumName.replace(/ /g, '-')}`);
    } else {
      showToastWithCooldown(`Error uploading files`, false);
    }
  };

  const [faceDetection, setFaceDetection] = useState<boolean>(false);

  return (
    <div
      className={`flex flex-col items-center justify-center ${sidebarOpened ? 'pl-4' : ''} pr-4`}
    >
      {/* {isLoading && (
        <div className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transform`}>
          <LoadingSpinner size={48} />
        </div>
      )} */}
      <Drawer>
        <div className="z-20 mt-4 flex w-full items-center justify-between">
          <h1 className="text-2xl font-bold">Albums</h1>

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
              {!uploading ? (
                <>
                  <Label>Album Name</Label>
                  <Input value={albumName} onChange={(e) => setAlbumName(e.target.value)} />

                  <div className="mt-4 flex space-x-2">
                    <Label>Face Detection</Label>
                    <Switch checked={faceDetection} onCheckedChange={setFaceDetection} />
                  </div>
                </>
              ) : (
                <></>
              )}
              {uploading && (
                <div>
                  {socketMessages.upload_bytes <= socketMessages.total_bytes && (
                    <>
                      <Label>Uploading...</Label>
                      <Progress
                        value={Math.min(
                          (socketMessages.upload_bytes / socketMessages.total_bytes) * 100,
                          100,
                        )}
                      />
                    </>
                  )}
                  {(socketMessages.upload_bytes !== 0 ||
                    socketMessages.upload_bytes === socketMessages.total_bytes) && (
                    <div>
                      <Label>Processing...</Label>
                    </div>
                  )}
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
      <div className="z-10 mt-4 grid w-full grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
        {albums.map((album) => (
          <FadeIn key={album.album_name}>
            <Link
              href={`/admin/albums/${album.slug}/photos`}
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
                      <div key={photo.compressed_image}>
                        <AspectRatio ratio={1}>
                          <Image
                            src={photo.compressed_image}
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
          </FadeIn>
        ))}
      </div>
    </div>
  );
}

export default AlbumsPage;
