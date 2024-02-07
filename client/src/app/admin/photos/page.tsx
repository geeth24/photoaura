'use client';
import React from 'react';
import axios from 'axios';
import PhotosGrid, { Album } from '@/components/PhotosGrid';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { showToastWithCooldown } from '@/components/ToastCooldown';
function Page() {
  const [photos, setPhotos] = React.useState<Album[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const { user, sidebarOpened } = useAuth();

  React.useEffect(() => {
    setIsLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/photos/?user_id=${user?.id}`)
      .then((response) => response.json())
      .then((data) => {
        setPhotos(data);
        setIsLoading(false);
        showToastWithCooldown('Photos loaded', true);
      })
      .catch((error) => {
        console.error('Error:', error);
        setIsLoading(false);
        showToastWithCooldown('Error loading photos', false);
      });
  }, []);

  return (
    <div className={`w-full ${sidebarOpened ? 'pl-4' : ''} pr-4`}>
      {isLoading && (
        <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform`}>
          <LoadingSpinner size={48} />
        </div>
      )}
      <PhotosGrid albums={photos} />
    </div>
  );
}

export default Page;
