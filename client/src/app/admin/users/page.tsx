import UsersTable, { User } from '@/components/UsersTable';
import { cookies } from 'next/headers';
import React from 'react';
async function Page() {
  const cookieStore = cookies();
  const userToken = cookieStore.get('token')?.value;

  const users: User[] = await getUsers(userToken);
  return (
    <div>
      <UsersTable usersData={users} />
    </div>
  );
}

export default Page;

async function getUsers(token: string | undefined): Promise<User[]> {
  const response = await fetch(`${process.env.API_URL}/users/`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user data');
  }

  return response.json();
}
