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
import { usePathname, useRouter } from 'next/navigation';
import { FadeIn, FadeInStagger } from './FadeIn';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [current, setCurrent] = React.useState(selectedImageIndex);

  const handleNext = () => setCurrent((prev) => (prev + 1) % albums.length);
  const handlePrev = () => setCurrent((prev) => (prev - 1 + albums.length) % albums.length);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative h-full max-h-[90vh] w-full max-w-4xl"
          onClick={(e) => e.stopPropagation()}
        >
          <Image
            src={albums[current].image || '/placeholder.svg'}
            alt="Enlarged photo"
            layout="fill"
            objectFit="contain"
            priority
          />
          <button className="absolute right-4 top-4 text-white" onClick={onClose}>
            Close
          </button>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 transform text-white"
            onClick={handlePrev}
          >
            Prev
          </button>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 transform text-white"
            onClick={handleNext}
          >
            Next
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
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
                  key={album.compressed_image}
                  className="after:content after:shadow-highlight group relative mb-5 block w-full cursor-zoom-in after:pointer-events-none after:absolute after:inset-0 after:rounded-lg"
                >
                  <Image
                    src={album.compressed_image}
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
