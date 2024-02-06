'use client';
import { useAuth } from '@/context/AuthContext';
import React, { useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Album } from './PhotosGrid';
import { getCookie } from 'cookies-next';
import { Button } from './ui/button';
import { Label } from '@radix-ui/react-label';
import { Input } from './ui/input';
import { Pencil1Icon } from '@radix-ui/react-icons';
import { ModeToggle } from './ui/mode-toggle';
export type User = {
  id: number;
  user_name: string;
  full_name: string;
  user_email: string;
  albums: Album[];
};
function UsersTable() {
  const { sidebarOpened } = useAuth();
  const [users, setUsers] = React.useState<User[]>([]);
  const [selectedUser, setSelectedUser] = React.useState<User>({} as User);
  const [newUser, setNewUser] = React.useState<User>({} as User);

  useEffect(() => {
    const storedToken = getCookie('token');

    if (!storedToken) {
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/`, {
      headers: {
        Authorization: `Bearer ${storedToken}`,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        setUsers(data);
      });
  }, []);

  const createNewUser = () => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_name: newUser.user_name,
        full_name: newUser.full_name,
        user_email: newUser.user_email,
        user_password: 'password',
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        setUsers([...users, data]);
      });
  };

  return (
    <div className={`w-full ${sidebarOpened ? 'pl-4' : ''} pr-4`}>
      <div className="mt-4 flex w-full items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="flex space-x-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button className="">New User</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>New User</SheetTitle>
                <div className="mt-4 flex h-[calc(100%-5rem)] flex-col justify-between space-y-4 ">
                  <SheetDescription className="flex flex-col space-y-2">
                    <Label>User Name</Label>
                    <Input
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          user_name: e.target.value,
                        })
                      }
                    />
                    <Label>Full Name</Label>
                    <Input
                      onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    />
                    <Label>Email</Label>
                    <Input
                      onChange={(e) => setNewUser({ ...newUser, user_email: e.target.value })}
                    />
                  </SheetDescription>

                  <Button onClick={createNewUser}>Create</Button>
                </div>
              </SheetHeader>
            </SheetContent>
          </Sheet>

          <ModeToggle />
        </div>
      </div>
      <Sheet>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit {selectedUser?.user_name}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex h-[calc(100%-3rem)] flex-col justify-between space-y-4 ">
            <div className="flex flex-col space-y-4">
              <div className="flex flex-col space-y-2">
                <Label htmlFor="album_name">User Name</Label>
                <Input
                  type="text"
                  placeholder="User Name"
                  value={selectedUser?.user_name}
                  onChange={(e) => {
                    setSelectedUser({
                      ...selectedUser,
                      user_name: e.target.value,
                    });
                  }}
                />
              </div>

              <div className="flex flex-col space-y-2">
                <Label htmlFor="album_name">Full Name</Label>
                <Input
                  type="text"
                  placeholder="Full Name"
                  value={selectedUser?.full_name}
                  onChange={(e) => {
                    setSelectedUser({
                      ...selectedUser,
                      full_name: e.target.value,
                    });
                  }}
                />
              </div>
              <div className="flex flex-col space-y-2">
                <Label htmlFor="album_name">Email</Label>
                <Input
                  type="text"
                  placeholder="Email"
                  value={selectedUser?.user_email}
                  onChange={(e) => {
                    setSelectedUser({
                      ...selectedUser,
                      user_email: e.target.value,
                    });
                  }}
                />
              </div>
            </div>

            <Button variant="destructive">Delete</Button>
          </div>
        </SheetContent>
        <Table className="mt-4">
          <TableCaption>A list of users</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>User Name</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Albums</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.id}</TableCell>
                <TableCell>{user.user_name}</TableCell>
                <TableCell>{user.full_name}</TableCell>
                <TableCell>{user.user_email}</TableCell>
                <TableCell>{user?.albums.length}</TableCell>
                <TableCell>
                  <SheetTrigger asChild>
                    <Button size="icon" onClick={() => setSelectedUser(user)}>
                      <Pencil1Icon className="h-[1.2rem] w-[1.2rem]" />
                    </Button>
                  </SheetTrigger>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Sheet>
    </div>
  );
}

export default UsersTable;
