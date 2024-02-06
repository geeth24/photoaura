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
import { getCookie } from 'cookies-next';
import { User } from '@/components/UsersTable';
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons';

import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

export interface AlbumGrid {
  album_name: string;
  slug: string;
  image_count: number;
  shared: boolean;
  album_permissions: User[];
  album_photos: Album[];
}

export type albumPermUser = {
  user_id: number;
  user_name: string;
  full_name: string;
  user_email: string;
};

type newAlbumUser = {
  id: number;
  user_name: string;
  full_name: string;
  user_email: string;
};

function Page({ params }: { params: { slug: string } }) {
  const [albumGrid, setAlbumGrid] = useState<AlbumGrid>({
    album_name: '',
    slug: '',
    image_count: 0,
    shared: false,
    album_permissions: [],
    album_photos: [],
  });
  const [users, setUsers] = useState<User[]>([]);
  const [albumPermissions, setAlbumPermissions] = useState<albumPermUser[]>([]);
  const [newAlbumUser, setNewAlbumUser] = useState<newAlbumUser>({} as newAlbumUser);
  const [action, setAction] = useState<string>('' as string); // ['delete', 'update'
  const [shared, setShared] = useState<boolean>(false);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/album/${params.slug}/`)
      .then((response) => {
        setAlbumGrid(response.data);
        console.log(response.data);
        setShared(response.data.shared);
        setAlbumPermissions(response.data.album_permissions);
      })
      .catch((error) => {
        console.log(error);
        toast.error('Album not found');
        // router.push('/admin/albums');
      });

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/`, {
      headers: {
        Authorization: `Bearer ${getCookie('token')}`,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        setUsers(data);
      });
  }, [router, params.slug]);

  const { sidebarOpened } = useAuth();

  const deleteAlbum = async (albumName: string) => {
    const response = await axios.delete(
      `${process.env.NEXT_PUBLIC_API_URL}/album/delete/${encodeURIComponent(albumName)}/`,
    );
    const result = response.data;
    console.log(result);
    router.push('/admin/albums');
  };

  const updateAlbum = async (newAlbumName: string, shared: boolean) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/album/?album_name=${params.slug.replace('-', ' ')}&album_new_name=${newAlbumName}&shared=${shared}${newAlbumUser.id ? `&user_id=${newAlbumUser.id}&action=${action}` : ''}`,
      {
        method: 'PUT',
      },
    );
    const result = await response.json();
    console.log(result);
    if (newAlbumName != '') {
      console.log(`${params.slug} ${newAlbumName}`);
      router.push(`/admin/albums/${newAlbumName.replace(/ /g, '-')}`);
    }
    toast.success('Album updated');
  };

  return (
    <div
      className={`flex flex-col items-center justify-center ${sidebarOpened ? 'pl-4' : ''} pr-4`}
    >
      {parseInt(user?.id ?? '') === 1 && (
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
            <div className="mt-4 flex h-[calc(100%-5rem)] flex-col justify-between space-y-4 ">
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
                <div className="mt-4 flex flex-col space-y-2">
                  <Label htmlFor="album_name">Users</Label>

                  <div className="grid grid-cols-4 gap-2">
                    {albumPermissions.map((user: albumPermUser) => (
                      <Badge
                        key={user.user_name}
                        className={`flex w-full items-center justify-center ${
                          user.user_id === 1 ? 'opacity-50' : ''
                        }`}
                        onClick={() => {
                          if (user.user_id === 1) {
                            toast.error('Cannot remove admin');
                            return;
                          }

                          setNewAlbumUser({
                            id: user.user_id,
                            user_name: user.user_name,
                            full_name: user.full_name,
                            user_email: user.user_email,
                          });
                          setAlbumPermissions(
                            albumPermissions.filter(
                              (albumPermission) => albumPermission.user_name !== user.user_name,
                            ),
                          );
                          setAction('delete');
                        }}
                      >
                        {user.user_name}
                      </Badge>
                    ))}
                  </div>
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                      >
                        {newAlbumUser.user_name
                          ? users.find((user) => user.user_name === newAlbumUser.user_name)
                              ?.user_name
                          : 'Select user...'}
                        <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command className="w-full">
                        <CommandInput placeholder="Search user..." className="h-9" />
                        <CommandEmpty>No user found.</CommandEmpty>
                        <CommandGroup>
                          {users.map((user) => (
                            <CommandItem
                              key={user.id}
                              value={user.user_name}
                              onSelect={(currentValue) => {
                                if (
                                  albumPermissions.find((user) => user.user_name === currentValue)
                                ) {
                                  toast.error('User already added');
                                  return;
                                }
                                setAlbumPermissions([
                                  ...albumPermissions,
                                  {
                                    user_id: user.id,
                                    user_name: user.user_name,
                                    full_name: user.full_name,
                                    user_email: user.user_email,
                                  },
                                ]);
                                setNewAlbumUser(
                                  users.find((user) => user.user_name === currentValue) ||
                                    ({ user_name: '' } as User),
                                );
                                setAction('update');

                                setOpen(false);
                              }}
                            >
                              {user.user_name}
                              <CheckIcon
                                className={cn(
                                  'ml-auto h-4 w-4',
                                  newAlbumUser.user_name === user.user_name
                                    ? 'opacity-100'
                                    : 'opacity-0',
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="mt-4 flex flex-col space-y-2">
                  <Label htmlFor="album_name">Share</Label>

                  <div className="mt-2 flex items-center space-x-2">
                    <Switch
                      checked={shared}
                      onCheckedChange={() => {
                        setShared(!shared);
                        if (!shared) {
                          toast.success('Link copied to clipboard');
                          // copy to clipboard
                          navigator.clipboard.writeText(
                            `https://aura.reactiveshots.com/share/${albumGrid.slug}`,
                          );
                        }
                        updateAlbum(albumGrid.album_name, !shared);
                        setAlbumGrid({
                          ...albumGrid,
                          shared: !shared,
                        });
                      }}
                    />
                    <Label htmlFor="album_name"> {albumGrid.shared ? 'Shared' : 'Private'}</Label>
                  </div>
                </div>
                {shared && (
                  <div className="mt-2 flex flex-col space-y-2">
                    <Label>Share Link</Label>
                    <Input
                      type="text"
                      value={`https://aura.reactiveshots.com/share/${albumGrid.slug}`}
                      readOnly
                    />
                    <Alert>
                      <CopyIcon className="h-4 w-4" />
                      <AlertTitle>Share Link</AlertTitle>
                      <AlertDescription>
                        Anyone with this link can view this album.
                      </AlertDescription>
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
      )}
      <PhotosGrid albums={albumGrid.album_photos} />
    </div>
  );
}

export default Page;
