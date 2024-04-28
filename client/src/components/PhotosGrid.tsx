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
                src={album.compressed_image}
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

  return (
    <>
      <div
        // faster
        className="mt-4 columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4"
      >
        <div className="after:content shadow-highlight after:shadow-highlight relative mb-5 flex h-[350px]  flex-col items-center justify-end gap-4 overflow-hidden rounded-lg bg-primary/10 px-6 pb-16 pt-64 text-center text-primary after:pointer-events-none after:absolute after:inset-0 after:rounded-lg lg:pt-0">
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <span className="flex max-h-full max-w-full items-center justify-center">
              <svg
                width="265"
                height="271"
                viewBox="0 0 265 271"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M214.007 120.993C214.007 112.912 207.293 106.383 198.982 106.383H183.79C191.659 116.712 196.338 129.502 196.338 143.36C196.338 157.222 191.659 170.009 183.79 180.338H198.982C207.293 180.338 214.007 173.809 214.007 165.73V120.993ZM132.435 5.56328C72.2705 5.56328 21.6328 44.8423 5.94325 98.4099H0C15.7979 41.6861 69.0793 0 132.435 0C195.735 0 249.016 41.6861 264.814 98.4099H258.868C243.181 44.8423 192.541 5.56328 132.435 5.56328ZM132.435 265.157C72.2705 265.157 21.6328 225.878 5.94325 172.311H0C15.7979 229.034 69.0793 270.721 132.435 270.721C195.735 270.721 249.016 229.034 264.814 172.311H258.868C243.181 225.878 192.541 265.157 132.435 265.157ZM179.331 143.36C179.331 118.156 158.304 97.769 132.435 97.769C106.507 97.769 85.4832 118.156 85.4832 143.36C85.4832 168.565 106.507 188.955 132.435 188.955C158.304 188.955 179.331 168.565 179.331 143.36ZM81.077 180.338C73.1517 170.009 68.4732 157.222 68.4732 143.36C68.4732 129.502 73.1517 116.712 81.077 106.383H65.8324C57.5207 106.383 50.8045 112.912 50.8045 120.993V165.73C50.8045 173.809 57.5207 180.338 65.8324 180.338H81.077ZM110.36 85.0301C117.243 82.5689 124.674 81.233 132.435 81.233C140.141 81.233 147.571 82.5689 154.451 85.0301V73.0433C154.451 68.3887 150.543 64.5887 145.753 64.5887H119.058C114.268 64.5887 110.36 68.3887 110.36 73.0433V85.0301ZM227.547 120.993V165.73C227.547 181.033 214.724 193.501 198.982 193.501H170.194C159.569 201.047 146.526 205.488 132.435 205.488C118.288 205.488 105.242 201.047 94.6733 193.501H65.8324C50.0902 193.501 37.3195 181.033 37.3195 165.73V120.993C37.3195 105.688 50.0902 93.2198 65.8324 93.2198H94.6733C95.0597 92.952 95.4433 92.6843 95.8854 92.4165V73.4734C95.8854 62.6089 104.967 53.8325 116.087 53.8325H148.728C159.9 53.8325 168.981 62.6089 168.981 73.4734V92.4165C169.368 92.6843 169.754 92.952 170.194 93.2198H198.982C214.724 93.2198 227.547 105.688 227.547 120.993ZM132.435 102.264C109.04 102.264 90.1061 120.672 90.1061 143.36C90.1061 156.578 96.5441 168.351 106.563 175.897L165.846 118.21C158.14 108.522 146.028 102.264 132.435 102.264ZM174.486 147.642L136.838 184.243C156.653 182.264 172.451 166.961 174.486 147.642ZM91.8656 85.9417C91.8656 80.2701 87.1344 75.721 81.3522 75.721H70.344C64.5091 75.721 59.8306 80.2701 59.8306 85.9417V89.0979H91.8656V85.9417ZM194.467 75.721H183.459C179.993 75.721 176.965 77.3247 175.036 79.84H202.89C200.964 77.3247 197.936 75.721 194.467 75.721ZM172.946 86.4231C172.946 84.016 174.983 82.0334 177.46 82.0334H208.008C210.485 82.0334 212.522 84.016 212.522 86.4231C212.522 88.8301 210.485 90.8099 208.008 90.8099H177.46C174.983 90.8099 172.946 88.8301 172.946 86.4231Z"
                  className="fill-current"
                />
              </svg>
            </span>
            <span className="absolute bottom-0 left-0 right-0 h-[200px] bg-gradient-to-b from-primary/0 via-primary to-primary"></span>
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
          <FadeIn key={album.compressed_image}>
            <Link
              href={`${slug == undefined ? `/admin/photos/${index}` : `${share ? `/share/${slug}/photos/${index}` : `/admin/albums/${slug}/photos/${index}`}`}`}
              key={album.compressed_image}
              className="after:content after:shadow-highlight group relative mb-5 block w-full cursor-zoom-in after:pointer-events-none after:absolute after:inset-0 after:rounded-lg"
            >
              <Image
                src={album.compressed_image}
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
            </Link>
          </FadeIn>
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
