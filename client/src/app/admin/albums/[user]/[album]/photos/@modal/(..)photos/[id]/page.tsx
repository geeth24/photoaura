'use client';
import { PhotoModal } from '@/components/PhotosGrid';
import { showToastWithCooldown } from '@/components/ToastCooldown';
import { useParams } from 'next/navigation';
import React from 'react';
import { AlbumGrid } from '../../../page';

export default function PhotoModalPage({ params: { id } }: { params: { id: string } }) {
  const [albumGrid, setAlbumGrid] = React.useState<AlbumGrid>({
    album_name: '',
    image_count: 0,
    shared: false,
    upload: false,
    secret: '',
    album_photos: [],
    slug: '',
    album_permissions: [],
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const urlParams = useParams();

  React.useEffect(() => {
    const fetchAlbum = async () => {
      setIsLoading(true);
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/album/${urlParams.user}/${urlParams.album}/`)
        .then((response) => response.json())
        .then((data) => {
          setAlbumGrid(data);
          setIsLoading(false);
          showToastWithCooldown('Album loaded', true);
        })
        .catch((error) => {
          console.error('Error:', error);
          setIsLoading(false);
          showToastWithCooldown('Error loading album', false);
        });
    };
    fetchAlbum();
  }, []);

  return (
    <PhotoModal
      albums={albumGrid.album_photos}
      selectedImageIndex={Number(urlParams.id)}
      onClose={() => {}}
    />
  );
}
