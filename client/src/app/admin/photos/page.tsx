'use client';
import React from 'react';
import axios from 'axios';
import PhotosGrid, { Album } from '@/components/PhotosGrid';
import { useAuth } from '@/context/AuthContext';
function Page() {
  const [photos, setPhotos] = React.useState<Album[]>([]);
  const { user, sidebarOpened } = useAuth();

  React.useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/photos/?user_id=${user?.id}`)
      .then((response) => response.json())
      .then((data) => {
        setPhotos(data);
      });
  }, []);


  return (
    <div className={`w-full ${sidebarOpened ? 'pl-4' : ''} pr-4`}>
      <PhotosGrid albums={photos} />
    </div>
  );
}

export default Page;
