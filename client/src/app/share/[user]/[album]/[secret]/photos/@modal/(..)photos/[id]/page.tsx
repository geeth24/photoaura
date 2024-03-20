'use client';
import { AlbumGrid } from '@/app/admin/albums/[user]/[album]/photos/page';
import { Album, PhotoModal } from '@/components/PhotosGrid';
import { showToastWithCooldown } from '@/components/ToastCooldown';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { useParams } from 'next/navigation';
import React from 'react';

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
  const { user, sidebarOpened } = useAuth();
  const urlParams = useParams();

  React.useEffect(() => {
    const fetchAlbum = async () => {
      setIsLoading(true);
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/album/${urlParams.user}/${urlParams.album}/?secret=${urlParams.secret}`,
      )
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
      selectedImageIndex={Number(id)}
      onClose={() => {}}
    />
  );
}
