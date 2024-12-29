import CMS, { AlbumSmall, Category, CategoryLinked } from '@/components/CMS';
import { cookies } from 'next/headers';
import React from 'react';
import { CookieUser } from '../photos/page';

async function Page() {
  const cookieStore = cookies();
  const encodedUser = cookieStore.get('user')?.value;
  const token = cookieStore.get('token')?.value;

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

  const albums: AlbumSmall[] = await getAlbums(Number(id), token);
  const categoriesLinkedData: CategoryLinked[] = await getLinkedCategories(token);
  console.log(categoriesLinkedData);
  const categoriesData: Category[] = await getCategories(token);

  return (
    <div>
      <CMS
        albumsData={albums}
        categoriesLinkedData={categoriesLinkedData}
        categoriesData={categoriesData}
      />
    </div>
  );
}

async function getLinkedCategories(token: string | undefined): Promise<CategoryLinked[]> {
  const response = await fetch(`${process.env.API_URL}/category-albums`, {
    cache: 'no-cache',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch album data');
  }

  return response.json();
}

async function getCategories(token: string | undefined): Promise<Category[]> {
  const response = await fetch(`${process.env.API_URL}/categories`, {
    cache: 'no-cache',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch album data');
  }

  return response.json();
}
async function getAlbums(userId: number, token: string | undefined): Promise<AlbumSmall[]> {
  const response = await fetch(`${process.env.API_URL}/albums/?user_id=${userId}`, {
    cache: 'no-cache',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch album data');
  }

  return response.json();
}

export default Page;
