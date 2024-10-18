import React from 'react';
import PhotosGrid, { Album } from '@/components/PhotosGrid';
import { cookies } from 'next/headers';
import PhotosPage from '@/components/PhotosPage';

type CookieUser = {
  id: number;
  user_name: string;
  full_name: string;
  user_email: string;
};

export default async function Page() {
  const cookieStore = cookies();
  const encodedUser = cookieStore.get('user')?.value;

  var id = '';

  if (encodedUser) {
    try {
      // Decode and parse the user cookie
      const decodedUser = decodeURIComponent(encodedUser);
      const user: CookieUser = JSON.parse(decodedUser);

      id = user.id.toString();
    } catch (error) {
      console.error('Error parsing user or fetching photos:', error);
    }
  } else {
    console.error('User cookie not found');
  }

  const photosData: Album[] = await getPhotos(Number(id));

  // If no photos data, handle appropriately
  return (
    <>
      <PhotosPage albums={photosData} />
    </>
  );
}

async function getPhotos(userId: number): Promise<Album[]> {
  const response = await fetch(`${process.env.API_URL}/photos/?user_id=${userId}`, {
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch album data');
  }

  return response.json();
}
