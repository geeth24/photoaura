'use client';
import React from 'react';
import PhotosGrid, { Album } from './PhotosGrid';
import { useAuth } from '@/context/AuthContext';
type PhotosPageProps = {
  albums: Album[];
};
function PhotosPage({ albums }: PhotosPageProps) {
  const { sidebarOpened } = useAuth();
  return (
    <div className={`w-full ${sidebarOpened ? 'pl-4' : ''} pr-4`}>
      <PhotosGrid albums={albums} />
    </div>
  );
}

export default PhotosPage;
