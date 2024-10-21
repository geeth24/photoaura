import CMS, { AlbumSmall, Category, CategoryLinked } from '@/components/CMS';
import { cookies } from 'next/headers';
import React from 'react';
import { CookieUser } from '../photos/page';

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

  const albums: AlbumSmall[] = await getAlbums(Number(id));
  const categoriesLinkedData: CategoryLinked[] = await getLinkedCategories();
  console.log(categoriesLinkedData);
  const categoriesData: Category[] = await getCategories();

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

async function getLinkedCategories(): Promise<CategoryLinked[]> {
  const response = await fetch(`${process.env.API_URL}/category-albums`, {
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch album data');
  }

  return response.json();
}

async function getCategories(): Promise<Category[]> {
  const response = await fetch(`${process.env.API_URL}/categories`, {
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch album data');
  }

  return response.json();
}
async function getAlbums(userId: number): Promise<AlbumSmall[]> {
  const response = await fetch(`${process.env.API_URL}/albums/?user_id=${userId}`, {
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch album data');
  }

  return response.json();
}

export default Page;
