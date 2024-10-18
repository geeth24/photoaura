import { AlbumGrid } from '@/components/AlbumPage';
import AlbumsPage from '@/components/AlbumsPage';
import { cookies } from 'next/headers';
import React from 'react';

type CookieUser = {
  id: number;
  user_name: string;
  full_name: string;
  user_email: string;
};

async function Page() {
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

  const albumsData: AlbumGrid[] = await getAlbums(Number(id));

  return <AlbumsPage albumsData={albumsData} />;
}

async function getAlbums(userId: number): Promise<AlbumGrid[]> {
  const response = await fetch(`${process.env.API_URL}/albums/?user_id=${userId}`, {
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch album data');
  }

  return response.json();
}

export default Page;
