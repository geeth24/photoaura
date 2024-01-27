'use client';

import PhotosGrid, { Album } from '@/components/PhotosGrid';
import { Button } from '@/components/ui/button';
import { CopyIcon, Pencil1Icon } from '@radix-ui/react-icons';
import axios from 'axios';
import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/context/AuthContext';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export interface AlbumGrid {
  album_name: string;
  image_count: number;
  shared: boolean;
  album_photos: Album[];
}

function Page({ params }: { params: { slug: string } }) {
  const [albumGrid, setAlbumGrid] = useState<AlbumGrid>({
    album_name: '',
    image_count: 0,
    shared: false,
    album_photos: [],
  });
  const [shared, setShared] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    axios
      .get(`https://photoaura-api.reactiveshots.com/album/${params.slug}`)
      .then((response) => {
        setAlbumGrid(response.data);
        setShared(response.data.shared);
      })
      .catch((error) => {
        console.log(error);
        toast.error('Album not found');
        router.push('/admin/albums');
      });
  }, [router, params.slug]);

  const { sidebarOpened } = useAuth();

  const deleteAlbum = async (albumName: string) => {
    // const response = await fetch(
    //   `https://photoaura-api.reactiveshots.com/album/${encodeURIComponent(albumName)}`,
    //   {
    //     method: 'DELETE',
    //   },
    // );
    // const result = await response.json();

    const response = await axios.delete(
      `https://photoaura-api.reactiveshots.com/album/${encodeURIComponent(albumName)}`,
    );
    const result = response.data;
    console.log(result);
    router.push('/admin/albums');
  };

  const updateAlbum = async (newAlbumName: string, shared: boolean) => {
    const response = await fetch(
      `https://photoaura-api.reactiveshots.com/album/?album_name=${params.slug}&album_new_name=${newAlbumName}&shared=${shared}`,
      {
        method: 'PUT',
      },
    );
    const result = await response.json();
    console.log(result);
    router.push('/admin/albums?album_updated=true');
  };

  return (
    <div
      className={`flex flex-col items-center justify-center ${sidebarOpened ? 'pl-4' : ''} pr-4`}
    >
      <Sheet>
        <div className="mt-4 flex w-full justify-between">
          <h1 className="text-3xl font-bold">{albumGrid.album_name}</h1>
          <SheetTrigger asChild>
            <Button size="icon">
              <Pencil1Icon className="h-[1.2rem] w-[1.2rem]" />
            </Button>
          </SheetTrigger>
        </div>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit {albumGrid.album_name}</SheetTitle>
            <SheetDescription className="flex flex-col space-y-2">
              {albumGrid.image_count} photos
            </SheetDescription>
          </SheetHeader>

          <div className="space mt-4 flex h-[calc(100%-5rem)] flex-col justify-between space-y-4 ">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="album_name">Album name</Label>
              <Input
                type="text"
                placeholder="Album name"
                value={albumGrid.album_name}
                onChange={(e) => {
                  setAlbumGrid({
                    ...albumGrid,
                    album_name: e.target.value,
                  });
                }}
              />

              <div className="mt-2 flex items-center space-x-2">
                <Switch
                  checked={shared}
                  onCheckedChange={() => {
                    setShared(!shared);
                    if (!shared) {
                      toast.success('Link copied to clipboard');
                      // copy to clipboard
                      navigator.clipboard.writeText(
                        `https://photoaura.reactiveshots.com/share/${albumGrid.album_name}`,
                      );
                    }
                  }}
                />
                <Label htmlFor="album_name"> {albumGrid.shared ? 'Shared' : 'Private'}</Label>
              </div>
              {shared && (
                <div className="mt-2 flex flex-col space-y-2">
                  <Label>Share Link</Label>
                  <Input
                    type="text"
                    value={`https://photoaura.reactiveshots.com/share/${albumGrid.album_name}`}
                    readOnly
                  />
                  <Alert>
                    <CopyIcon className="h-4 w-4" />
                    <AlertTitle>Share Link</AlertTitle>
                    <AlertDescription>Anyone with this link can view this album.</AlertDescription>
                  </Alert>
                </div>
              )}
              <Button
                onClick={() => {
                  updateAlbum(albumGrid.album_name, shared);
                }}
                className="mt-2"
              >
                Update
              </Button>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" color="red">
                  Delete Album
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Album</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this album? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      deleteAlbum(albumGrid.album_name);
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SheetContent>
      </Sheet>
      <PhotosGrid albums={albumGrid.album_photos} />
    </div>
  );
}

export default Page;
