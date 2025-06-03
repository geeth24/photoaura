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
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { Progress } from '@/components/ui/progress';
import { showToastWithCooldown } from '@/components/ToastCooldown';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export interface AlbumGrid {
  album_name: string;
  slug: string;
  image_count: number;
  shared: boolean;
  upload: boolean;
  secret: string;
  face_detection: boolean;
  album_permissions: albumPermUser[];
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
type SocketMessage = {
  upload_bytes: number;
  total_bytes: number;
};

interface AlbumPageProps {
  albumData: AlbumGrid;
  usersData: User[];
}

function AlbumPage({ albumData, usersData }: AlbumPageProps) {
  const params = useParams();

  const albumSlug = params.album;
  const userSlug = params.user;

  const slug = `${albumSlug}`;

  const [albumGrid, setAlbumGrid] = useState<AlbumGrid>({
    album_name: albumData.album_name,
    slug: albumData.slug,
    image_count: albumData.image_count,
    shared: albumData.shared,
    upload: albumData.upload,
    secret: albumData.secret,
    face_detection: albumData.face_detection,
    album_permissions: albumData.album_permissions,
    album_photos: albumData.album_photos,
  });
  //   console.log(albumGrid);
  const [users, setUsers] = useState<User[]>(usersData);
  const [albumPermissions, setAlbumPermissions] = useState<albumPermUser[]>(
    albumData.album_permissions,
  );
  const [newAlbumUser, setNewAlbumUser] = useState<newAlbumUser>({} as newAlbumUser);
  const [action, setAction] = useState<string>('' as string); // ['delete', 'update'
  const [shared, setShared] = useState<boolean>(albumData.shared);
  const [upload, setUpload] = useState<boolean>(albumData.upload);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [socketMessages, setSocketMessages] = useState<SocketMessage>({
    upload_bytes: 0,
    total_bytes: 0,
  });
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  const getAlbum = async () => {
    setIsLoading(true);
    await axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/album/${userSlug}/${albumSlug}/`, {
        headers: {
          Authorization: `Bearer ${getCookie('token')}`,
        },
      })
      .then((response) => {
        setAlbumGrid(response.data);
        // console.log(response.data);
        setShared(response.data.shared);
        setUpload(response.data.upload);
        setAlbumPermissions(response.data.album_permissions);
        setIsLoading(false);
        showToastWithCooldown('Album loaded', true);
      })
      .catch((error) => {
        // console.log(error);
        toast.error('Album not found');
        // router.push('/admin/albums');
        setIsLoading(false);
        showToastWithCooldown('Error loading album', false);
      });

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/`, {
      headers: {
        Authorization: `Bearer ${getCookie('token')}`,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        setUsers(data);
      });
  };

  const { sidebarOpened } = useAuth();

  const deleteAlbum = async (albumName: string) => {
    const response = await axios.delete(
      `${process.env.NEXT_PUBLIC_API_URL}/album/delete/${userSlug}/${albumName}/`,
    );
    const result = response.data;
    // console.log(result);
    router.push('/admin/albums');
  };

  const updateAlbum = async (newAlbumName: string, shared: boolean, upload: boolean = false) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/album/?album_name=${slug.replace('-', ' ')}&album_new_name=${newAlbumName}&shared=${shared}&upload=${upload}&slug=${userSlug}/${albumSlug}${newAlbumUser.id ? `&user_id=${newAlbumUser.id}&action=${action}` : `&user_id=${user?.id}`}`,
      {
        method: 'PUT',
      },
    );
    const result = await response.json();
    // console.log(result);
    if (slug !== newAlbumName.split(' ').join('-').toLowerCase()) {
      router.push(`/admin/albums/${userSlug}/${newAlbumName.toLowerCase().replace(' ', '-')}`);
    }
    toast.success('Album updated');
  };

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
      // console.log('Message from server:', event.data);
      setSocketMessages(JSON.parse(event.data));
    };

    const formData = new FormData();

    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append('files', selectedFiles[i]);
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/upload-files/?album_name=${encodeURIComponent(albumGrid.album_name)}&user_id=${user?.id}&update=true&face_detection=${albumGrid.face_detection}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getCookie('token')}`,
        },
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
    getAlbum();
    // close the drawer
  };

  return (
    <div
      className={`flex flex-col items-center justify-center ${sidebarOpened ? 'pl-4' : ''} pr-4`}
    >
      {/* {isLoading && (
        <div
          className={`absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transform`}
        >
          <LoadingSpinner size={48} />
        </div>
      )} */}
      {parseInt(user?.id ?? '') === 1 && (
        <Sheet>
          <div className="z-20 mt-4 flex w-full justify-between">
            <h1 className="text-3xl font-bold">{albumGrid.album_name}</h1>

            <div className="flex space-x-2">
              <Drawer>
                <DrawerTrigger asChild>
                  <Button className="">Upload Photos</Button>
                </DrawerTrigger>

                <DrawerContent
                  className={`ml-auto w-full ${sidebarOpened ? 'md:pl-16' : 'pl-[21%]'} transition-all duration-500`}
                >
                  <DrawerHeader>
                    <DrawerTitle>Upload Photos</DrawerTitle>
                    <DrawerDescription>Select and upload photos to this album</DrawerDescription>
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
              <SheetTrigger asChild>
                <Button size="icon">
                  <Pencil1Icon className="h-[1.2rem] w-[1.2rem]" />
                </Button>
              </SheetTrigger>
            </div>
          </div>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Edit {albumGrid.album_name}</SheetTitle>
              <SheetDescription className="flex flex-col space-y-2">
                {albumGrid.image_count} photos
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 flex h-[calc(100%-5rem)] flex-col justify-between space-y-4">
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
                  <Popover modal open={open} onOpenChange={setOpen}>
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
                        <CommandList>
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
                        </CommandList>
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
                            `https://aura.reactiveshots.com/share/${albumGrid.slug}/${albumGrid.secret}`,
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
                      value={`${process.env.NEXT_PUBLIC_API_URL?.includes('localhost') ? 'http://localhost:3000' : `${process.env.NEXT_PUBLIC_CLIENT_URL}`}/share/${albumGrid.slug}/${albumGrid.secret}/photos`}
                      readOnly
                    />
                    <Label>API Endpoint (Public)</Label>
                    <div className="flex space-x-2">
                      <Input
                        type="text"
                        value={`${process.env.NEXT_PUBLIC_API_URL}/album/${albumGrid.slug}/?secret=${albumGrid.secret}`}
                        readOnly
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `${process.env.NEXT_PUBLIC_API_URL}/album/${albumGrid.slug}/?secret=${albumGrid.secret}`,
                          );
                          toast.success('API endpoint copied to clipboard');
                        }}
                      >
                        <CopyIcon className="h-4 w-4" />
                      </Button>
                    </div>
                    <Alert>
                      <CopyIcon className="h-4 w-4" />
                      <AlertTitle>Share Link & API</AlertTitle>
                      <AlertDescription>
                        Anyone with this link can view this album. The API endpoint is public and
                        doesn&apos;t require authentication.
                      </AlertDescription>
                    </Alert>
                    <Button asChild>
                      <Link
                        href={`/share/${albumGrid.slug}/${albumGrid.secret}/photos`}
                        target="_blank"
                      >
                        Open Share Page
                      </Link>
                    </Button>
                  </div>
                )}
                <div className="mt-4 flex flex-col space-y-2">
                  <Label htmlFor="album_name">Upload Access</Label>

                  <div className="mt-2 flex items-center space-x-2">
                    <Switch
                      checked={upload}
                      onCheckedChange={() => {
                        setUpload(!upload);

                        updateAlbum(albumGrid.album_name, shared, !upload);
                        setAlbumGrid({
                          ...albumGrid,
                          upload: !upload,
                        });
                      }}
                    />
                    <Label htmlFor="album_name"> {albumGrid.upload ? 'Enabled' : 'Disabled'}</Label>
                  </div>
                </div>
                <div className="mt-4 flex flex-col space-y-2">
                  <Label htmlFor="album_name">Face Detection</Label>
                  <p className="text-sm text-muted-foreground">
                    Cannot be changed once {albumGrid.face_detection ? 'enabled' : 'disabled'}
                  </p>

                  <div className="mt-2 flex items-center space-x-2">
                    <Switch checked={albumGrid.face_detection} disabled />
                    <Label htmlFor="album_name">
                      {albumGrid.face_detection ? 'Enabled' : 'Disabled'}
                    </Label>
                  </div>
                </div>
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
      <PhotosGrid
        albums={albumGrid.album_photos}
        albumName={albumGrid.album_name}
        slug={`${userSlug}/${albumSlug}`}
      />
    </div>
  );
}

export default AlbumPage;
