'use client';
import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { type CarouselApi } from '@/components/ui/carousel';
import { Button } from './ui/button';
import {
  Cross1Icon,
  DownloadIcon,
  EnterFullScreenIcon,
  ExitFullScreenIcon,
} from '@radix-ui/react-icons';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FadeIn, FadeInStagger } from './FadeIn';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from 'next-themes';

export interface Album {
  album_name: string;
  image: string;
  compressed_image: string;
  file_metadata: {
    content_type: string;
    size: number;
    width: number;
    height: number;
    upload_date: string;
    exif_data: {
      [key: string]: any; // Since EXIF data can be very varied, use an index signature here.
    };
    blur_data_url: string;
  };
}

interface PhotoModalProps {
  albums: Album[];
  selectedImageIndex: number;
  onClose: () => void;
}

export const PhotoModal: React.FC<PhotoModalProps> = ({ albums, selectedImageIndex, onClose }) => {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!api) {
      return;
    }
    api.reInit({
      loop: true,
      align: 'center',
    });
    api.scrollTo(selectedImageIndex, true);
    // setCurrent(selectedImageIndex);
    api.on('select', () => {
      console.log('selected', api.selectedScrollSnap());
      setCurrent(Number(api.selectedScrollSnap()));
      console.log('current', current);
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.back();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    if (isFullScreen) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.fullscreenElement === null) return;
      document.exitFullscreen();
    }

    document.body.style.overflowY = 'hidden';
    return () => {
      document.body.style.overflowY = 'auto';
    };
  }, [selectedImageIndex, api, isFullScreen, onClose, api?.selectedScrollSnap]);

  if (albums.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-90 transition-all duration-500"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          router.back();
        }
      }}
    >
      <div className="absolute right-0 top-0 m-4 flex">
        <Button
          variant="ghost"
          size="icon"
          className="text-primary-foreground hover:text-secondary-foreground dark:text-secondary-foreground"
          onClick={() => {
            if (api && api.selectedScrollSnap) {
              const url = albums[Number(api.selectedScrollSnap())].image;
              const filename = url.split('/').pop()?.split('?')[0];
              console.log(filename);
              if (filename) {
                axios({
                  url,
                  method: 'GET',
                  responseType: 'blob', // important
                }).then((response) => {
                  const url = window.URL.createObjectURL(new Blob([response.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', filename);
                  document.body.appendChild(link);
                  link.click();
                });
              }
            }
          }}
        >
          <DownloadIcon className="h-6 w-6" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="text-primary-foreground hover:text-secondary-foreground dark:text-secondary-foreground"
          onClick={() => setIsFullScreen(!isFullScreen)}
        >
          {isFullScreen ? (
            <ExitFullScreenIcon className="h-6 w-6" />
          ) : (
            <EnterFullScreenIcon className="h-6 w-6" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-primary-foreground hover:text-secondary-foreground dark:text-secondary-foreground"
          onClick={() => {
            router.back();
          }}
        >
          <Cross1Icon className="h-6 w-6" />
        </Button>
      </div>

      <Carousel className="max-w-[20rem] sm:max-w-lg md:max-w-5xl" setApi={setApi}>
        <CarouselContent>
          {albums.map((album, index) => (
            <CarouselItem key={index} className="h-[calc(100vh-20rem)] md:h-[calc(100vh-5rem)]">
              <Image
                src={album.image}
                width={1920}
                height={1080}
                alt="Enlarged photo"
                priority
                className="h-full w-full rounded-md object-contain"
                blurDataURL={album.file_metadata.blur_data_url}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
};

function PhotosGrid({
  albums,
  albumName,
  slug,
  share,
}: {
  albums: Album[];
  albumName?: string;
  slug?: string;
  share?: boolean;
}) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  const handleCloseModal = () => {
    setSelectedImageIndex(null);
  };
  const router = useRouter();
  const { user } = useAuth();

  const deletePhoto = async (photo_name: string) => {
    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/photo/delete/?slug=${slug}&photo_name=${photo_name}`,
      {
        method: 'DELETE',
      },
    );
    router.push(`/admin/albums/${slug}`);
  };

  const { theme } = useTheme();

  return (
    <>
      <div
        // faster
        className="mt-4 columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4"
      >
        <div className="after:content shadow-highlight after:shadow-highlight relative mb-5 flex h-[350px] flex-col items-center justify-end gap-4 overflow-hidden rounded-lg bg-primary/10 px-6 pb-16 pt-64 text-center text-primary after:pointer-events-none after:absolute after:inset-0 after:rounded-lg lg:pt-0">
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <span className="flex max-h-full max-w-full items-center justify-center">
              <Image
                src={`${theme === 'dark' ? '/images/logo.png' : '/images/logo-blue.png'}`}
                width={200}
                height={200}
                alt="Photos"
                className="h-full w-full"
              />
            </span>
            <span className="absolute bottom-0 left-0 right-0 h-[200px] bg-gradient-to-b from-primary/10 via-primary to-primary"></span>
          </div>
          <h1 className="mb-4 mt-8 text-base font-bold uppercase tracking-widest">
            {slug == undefined ? 'Photos' : `${albumName}`}
          </h1>
          <p className="max-w-[40ch] text-secondary-foreground sm:max-w-[32ch]">
            {slug == undefined
              ? 'Browse through the photos below'
              : `Browse through the photos in the album "${albumName}" below`}
          </p>
        </div>
        {albums.map((album, index) => (
          <div key={album.image}>
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <Link
                  href={`${slug == undefined ? `/admin/photos/${index}` : `${share ? `/share/${slug}/photos/${index}` : `/admin/albums/${slug}/photos/${index}`}`}`}
                  key={album.image}
                  className="after:content after:shadow-highlight group relative mb-5 block w-full cursor-zoom-in after:pointer-events-none after:absolute after:inset-0 after:rounded-lg"
                >
                  <Image
                    src={album.image}
                    width={1920}
                    height={1080}
                    style={{ transform: 'translate3d(0, 0, 0)' }}
                    sizes="(max-width: 640px) 100vw,
         (max-width: 1280px) 75vw,
         (max-width: 1536px) 50vw,
         33vw"
                    alt="Photo"
                    className="transform rounded-lg brightness-90 transition will-change-auto group-hover:brightness-110"
                    placeholder="blur"
                    blurDataURL={album.file_metadata.blur_data_url}
                  />
                </Link>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  onClick={() => {
                    //copy link file name
                    navigator.clipboard.writeText(album.image.split('/').pop() || '');
                  }}
                >
                  Copy File Name
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => {
                    //copy link
                    navigator.clipboard.writeText(album.compressed_image);
                  }}
                >
                  Copy Compressed Link
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => {
                    //copy link
                    navigator.clipboard.writeText(album.image);
                  }}
                >
                  Copy Full Quality Link
                </ContextMenuItem>
                <ContextMenuItem asChild>
                  <Link href={album.image} target="_blank">
                    Open in new tab
                  </Link>
                </ContextMenuItem>
                {!share && (
                  <ContextMenuItem
                    onClick={() => {
                      //delete photo
                      deletePhoto(album.image.split('/').pop() || '');
                    }}
                    className="text-destructive"
                  >
                    Delete
                  </ContextMenuItem>
                )}
              </ContextMenuContent>
            </ContextMenu>
          </div>
        ))}
      </div>
      {selectedImageIndex !== null && (
        <PhotoModal
          albums={albums}
          selectedImageIndex={selectedImageIndex}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}

export default PhotosGrid;
