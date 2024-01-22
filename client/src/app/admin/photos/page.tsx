'use client';
import React from 'react';
import axios from 'axios';
import PhotosGrid, { Album } from '@/components/PhotosGrid';
import { useAuth } from '@/context/AuthContext';
function Page() {
  const [photos, setPhotos] = React.useState<Album[]>([]);

  React.useEffect(() => {
    axios.get('http://localhost:8000/photos').then((response) => {
      setPhotos(response.data);
    });
  }, []);

  const { sidebarOpened } = useAuth();

  return (
    <div className={`w-full ${sidebarOpened ? 'pl-4' : ''} pr-4`}>
      <PhotosGrid albums={photos} />
    </div>
  );
}

export default Page;
