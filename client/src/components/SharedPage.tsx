'use client';

import PhotosGrid from '@/components/PhotosGrid';
import { Input } from '@/components/ui/input';
import { ModeToggle } from '@/components/ui/mode-toggle';
import axios from 'axios';
import { useState, useEffect } from 'react';
import { LoadingSpinner } from './ui/loading-spinner';
import { Button } from './ui/button';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from './ui/drawer';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { Share2Icon } from '@radix-ui/react-icons';
import { toast } from 'sonner';
import { showToastWithCooldown } from './ToastCooldown';
import { AlbumGrid } from '@/app/admin/albums/[user]/[album]/page';

export const metadata = {
  title: 'Share',
  description: 'Share your albums',
};

function SharedPage({ params }: { params: { user: string; album: string; secret: string } }) {
  const [albumGrid, setAlbumGrid] = useState<AlbumGrid>({
    album_name: '',
    image_count: 0,
    shared: false,
    upload: false,
    secret: '',
    album_photos: [],
    slug: '',
    album_permissions: [],
  });
  const [shared, setShared] = useState<boolean>(true);
  const [upload, setUpload] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [socketMessages, setSocketMessages] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  useEffect(() => {
    fetchAlbum();
  }, [params]);

  const fetchAlbum = async () => {
    setIsLoading(true);
    await axios
      .get(
        `${process.env.NEXT_PUBLIC_API_URL}/album/${params.user}/${params.album}/?secret=${params.secret}`,
      )
      .then((response) => {
        setAlbumGrid(response.data);
        setShared(response.data.shared);
        setUpload(response.data.upload);
        setIsLoading(false);
        showToastWithCooldown('Album loaded', true);
      })
      .catch((error) => {
        console.error('Error:', error);
        setIsLoading(false);
        showToastWithCooldown('Error loading album', false);
      });
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
      setSocketMessages((prevMessages) => [...prevMessages, event.data]);
    };

    const formData = new FormData();

    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append('files', selectedFiles[i]);
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/upload-files/?album_name=${encodeURIComponent(albumGrid.album_name)}&slug=${albumGrid.slug}&update=true`,
      {
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
    fetchAlbum();
    // close the drawer
  };

  // Assuming we know the current phase based on the number of socket messages received
  const totalFiles = selectedFiles?.length ?? 0;
  const totalExpectedMessages = totalFiles * 2; // Total messages for both uploading and processing

  // Determine the phase
  const isUploading = socketMessages.length <= totalFiles;
  const isProcessing =
    socketMessages.length > totalFiles && socketMessages.length <= totalExpectedMessages;

  // Calculate progress for each phase
  let progress = 0;
  if (isUploading) {
    // Upload progress: 100% when socketMessages.length equals totalFiles
    progress = (socketMessages.length / totalFiles) * 100;
  } else if (isProcessing) {
    // Processing progress: Starts from 0% after uploading is done
    progress = ((socketMessages.length - totalFiles) / totalFiles) * 100;
  }
  if (shared && !isLoading) {
    return (
      <div className={`p-4`}>
        <div className="mt-4 flex  flex-row justify-between md:space-x-2 ">
          <h1 className="text-3xl font-bold ">{albumGrid.album_name}</h1>
          <div className="flex w-full items-center justify-end  space-x-2 ">
            {/* <Input
              type="text"
              value={`aura.reactiveshots.com/share/${albumGrid.slug}`}
              readOnly
              className="w-[calc(100%-3rem)] md:w-1/2 lg:w-1/3"
            /> */}
            {upload && (
              <Drawer>
                <DrawerTrigger asChild>
                  <Button className="">Upload Photos</Button>
                </DrawerTrigger>

                <DrawerContent className="ml-auto w-full  transition-all duration-500">
                  <DrawerHeader>
                    <DrawerTitle>Upload Photos</DrawerTitle>
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
                          {socketMessages.length <= totalFiles && (
                            <>
                              <Label>Uploading...</Label>
                              <Progress value={Math.min(progress, 100)} />
                            </>
                          )}
                          {socketMessages.length > totalFiles && (
                            <div>
                              <Label>Processing...</Label>
                              <Progress value={Math.min(progress, 100)} />
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
            )}
            <ModeToggle />
            <Button
              size="icon"
              onClick={async () => {
                if (navigator.share) {
                  try {
                    await navigator.share({
                      title: 'Check this album',
                      url: `https://aura.reactiveshots.com/share/${albumGrid.slug}`,
                    });
                    // Handle successful share here
                  } catch (error) {
                    // Handle errors or user cancellation here
                  }
                } else {
                  // Fallback for browsers that do not support the Web Share API
                  navigator.clipboard.writeText(
                    `https://aura.reactiveshots.com/share/${albumGrid.slug}`,
                  );
                  // Notify the user that the link has been copied to the clipboard
                  toast('Link copied to clipboard');
                }
              }}
            >
              <Share2Icon className="h-[1.2rem] w-[1.2rem]" />
            </Button>
          </div>
        </div>
        <PhotosGrid albums={albumGrid.album_photos} />
      </div>
    );
  } else if (!shared && !isLoading) {
    return (
      <div>
        <h1>Album is not shared</h1>
      </div>
    );
  } else if (isLoading) {
    return (
      <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform`}>
        <LoadingSpinner size={48} />
      </div>
    );
  }
}

export default SharedPage;
