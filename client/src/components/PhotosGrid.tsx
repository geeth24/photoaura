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

export interface Album {
  album_name: string;
  image: string;
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

const PhotoModal: React.FC<PhotoModalProps> = ({ albums, selectedImageIndex, onClose }) => {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  //zoom in and out of the image

  useEffect(() => {
    if (!api) {
      return;
    }
    api.reInit({
      // startIndex: selectedImageIndex,
      loop: true,
      align: 'center',
    });
    api.scrollTo(selectedImageIndex, true);
    setCurrent(selectedImageIndex);

    // if esc key is pressed, close the modal
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    if (isFullScreen) {
      document.documentElement.requestFullscreen();
    } else {
      // if alreday in exited state do nothing
      if (document.fullscreenElement === null) return;
      document.exitFullscreen();
    }

    // disable scrolling on the body when the modal is open
    document.body.style.overflowY = 'hidden';
    return () => {
      document.body.style.overflowY = 'auto';
    };
  }, [selectedImageIndex, api, isFullScreen, onClose]);
  if (albums.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-90 transition-all duration-500"
      //if clicked outside of the modal, close the modal
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="absolute right-0 top-0 m-4 flex">
        <Button
          variant="ghost"
          size="icon"
          className="text-primary-foreground hover:text-secondary-foreground dark:text-secondary-foreground"
          onClick={async () => {
            //download the image
            const handleDownload = async () => {
              try {
                const response = await axios.get(
                  albums[current].image.replace('/compressed', ''),

                  {
                    responseType: 'blob',
                  },
                );

                const blob = await response.data;
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = albums[current].image.split('/').pop() || 'image';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                URL.revokeObjectURL(blobUrl); // Clean up
              } catch (error) {
                console.error('Error downloading the file:', error);
              }
            };
            await handleDownload();
          }}
        >
          <DownloadIcon className="h-6 w-6" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="text-primary-foreground hover:text-secondary-foreground dark:text-secondary-foreground"
          onClick={() => {
            setIsFullScreen(!isFullScreen);
          }}
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
          onClick={onClose}
        >
          <Cross1Icon className="h-6 w-6" />
        </Button>
      </div>

      <Carousel className="max-w-[20rem] sm:max-w-lg md:max-w-5xl" setApi={setApi}>
        <CarouselContent>
          {albums.map((album, index) => (
            <CarouselItem key={index} className="h-[calc(100vh-20rem)] md:h-[calc(100vh-5rem)]">
              <img
                src={album.image}
                //1080p
                width={1920}
                height={1080}
                alt="Enlarged photo"
                className="h-full w-full rounded-md object-contain"
                // placeholder="blur"
                // blurDataURL={album.file_metadata.blur_data_url}
                // priority
                // onLoad={() => setLoaded(true)}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />

        <CarouselNext />
      </Carousel>
      {/* <button onClick={onClose}>Close</button> */}
    </div>
  );
};

function PhotosGrid({ albums }: { albums: Album[] }) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  const handleImageClick = (index: number) => {
    setSelectedImageIndex(index);
  };

  const handleCloseModal = () => {
    setSelectedImageIndex(null);
  };

  return (
    <>
      <div className="mt-4 columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4">
        {albums.map((album, index) => (
          // <FadeIn key={album.image}>
          <div
            onClick={() => handleImageClick(index)}
            key={album.image}
            className="after:content after:shadow-highlight group relative mb-5 block w-full cursor-zoom-in after:pointer-events-none after:absolute after:inset-0 after:rounded-lg"
          >
            <Image
              src={album.image}
              width={720}
              height={480}
              style={{ transform: 'translate3d(0, 0, 0)' }}
              sizes="(max-width: 640px) 100vw,
                  (max-width: 1280px) 50vw,
                  (max-width: 1536px) 33vw,
                  25vw"
              alt="Photo"
              className="transform rounded-lg brightness-90 transition will-change-auto group-hover:brightness-110"
              placeholder="blur"
              blurDataURL={album.file_metadata.blur_data_url}
            />
          </div>
          // </FadeIn>
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
