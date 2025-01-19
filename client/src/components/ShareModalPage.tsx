'use client';
import { AlbumGrid } from '@/components/AlbumPage';
import { Album, PhotoModal } from '@/components/PhotosGrid';
import { showToastWithCooldown } from '@/components/ToastCooldown';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { useParams } from 'next/navigation';
import React from 'react';
type Params = {
  user: string;
  album: string;
  secret: string;
  id: string;
};
export default function SharePhotoModalPage({ params }: { params: Params }) {
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
  const { user, sidebarOpened } = useAuth();

  React.useEffect(() => {
    const fetchAlbum = async () => {
      setIsLoading(true);
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/album/${params.user}/${params.album}/?secret=${params.secret}`,
      )
        .then((response) => response.json())
        .then((data) => {
          setAlbumGrid(data);
          console.log(data);
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
