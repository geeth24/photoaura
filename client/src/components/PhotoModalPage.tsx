'use client';
import { PhotoModal } from '@/components/PhotosGrid';
import { showToastWithCooldown } from '@/components/ToastCooldown';
import React from 'react';
import { AlbumGrid } from '@/components/AlbumPage';
type Params = {
  user: string;
  album: string;
  id: string;
};
export default function PhotoModalPage({ params }: { params: Params }) {
  const [albumGrid, setAlbumGrid] = React.useState<AlbumGrid>({
    album_name: '',
    image_count: 0,
    shared: false,
    upload: false,
    secret: '',
    face_detection: false,
    album_photos: [],
    slug: '',
    album_permissions: [],
  });
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchAlbum = async () => {
      setIsLoading(true);
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/album/${params.user}/${params.album}/`)
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
      selectedImageIndex={Number(params.id)}
      onClose={() => {}}
    />
  );
}
