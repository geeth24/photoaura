'use client';
import { Album, PhotoModal } from '@/components/PhotosGrid';
import { showToastWithCooldown } from '@/components/ToastCooldown';
import { useAuth } from '@/context/AuthContext';
import React from 'react';

type Params = {
  id: string;
};

export default function PhotoModalPage({ params }: { params: Params }) {
  const { id } = params;
  const [photos, setPhotos] = React.useState<Album[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const { user, sidebarOpened, accessToken } = useAuth();

  React.useEffect(() => {
    setIsLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/photos/?user_id=${user?.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((response) => response.json())
      .then((data) => {
        setPhotos(data);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Error:', error);
        setIsLoading(false);
        showToastWithCooldown('Error loading photos', false);
      });
  }, []);

  return <PhotoModal albums={photos} selectedImageIndex={Number(id)} onClose={() => {}} />;
}
