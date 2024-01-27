'use client';
import React from 'react';
import axios from 'axios';
import PhotosGrid, { Album } from '@/components/PhotosGrid';
import { useAuth } from '@/context/AuthContext';
function Page() {
  const [photos, setPhotos] = React.useState<Album[]>([]);

  React.useEffect(() => {
    // axios.get('https://photoaura-api.reactiveshots.com/photos').then((response) => {
    //   setPhotos(response.data);
    // });
    fetch('https://photoaura-api.reactiveshots.com/photos')
      .then((response) => response.json())
      .then((data) => {
        setPhotos(data);
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
