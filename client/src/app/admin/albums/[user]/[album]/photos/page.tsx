import { cookies } from 'next/headers'; // Next.js built-in headers utility
import { Button } from '@/components/ui/button';
import AlbumPage, { AlbumGrid } from '@/components/AlbumPage';
import { User } from '@/components/UsersTable';


// Page component with server-side logic
export default async function Page({
  params,
}: {
  params: Promise<{ user: string; album: string; id: string }>;
}) {
  const { album, user, id } = await params;
  const albumSlug = album;
  const userSlug = user;
  // Get cookies on the server side
  const cookieStore = await cookies();
  const userToken = cookieStore.get('token')?.value;

  const albumData: AlbumGrid = await getAlbum(userSlug, albumSlug, userToken);
  console.log(albumData);
  const users: User[] = await getUsers(userToken);

  return (
    <div>
      <AlbumPage albumData={albumData} usersData={users} />
    </div>
  );
}

// Server-side fetching functions with token parameter
async function getAlbum(
  userSlug: string,
  albumSlug: string,
  token: string | undefined,
): Promise<AlbumGrid> {
  const response = await fetch(`${process.env.API_URL}/album/${userSlug}/${albumSlug}/`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch album data');
  }

  return response.json();
}

async function getUsers(token: string | undefined): Promise<User[]> {
  const response = await fetch(`${process.env.API_URL}/users/`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user data');
  }

  return response.json();
}
