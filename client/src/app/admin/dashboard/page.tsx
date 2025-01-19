'use client';
import React, { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { animateValue } from '@/lib/utils';
import { FadeIn } from '@/components/FadeIn';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { getCookie } from 'cookies-next';

type DashboardResponse = {
  albums: number;
  users: number;
  photos: number;
};

function Page() {
  const { sidebarOpened, accessToken } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardResponse>({ albums: 0, users: 0, photos: 0 });

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/`, {
          headers: {
            Authorization: `Bearer ${getCookie('token')}`,
          },
        });
        const data = await response.json();
        setIsLoading(false);
        animateValue(0, data.photos, 500, (value) =>
          setDashboard((prev) => ({ ...prev, photos: value })),
        );
        animateValue(0, data.albums, 500, (value) =>
          setDashboard((prev) => ({ ...prev, albums: value })),
        );
        animateValue(0, data.users, 500, (value) =>
          setDashboard((prev) => ({ ...prev, users: value })),
        );
      } catch (error) {
        console.error('Error:', error);
        setIsLoading(false);
      }
    };
    fetchDashboard();
  }, [accessToken]);

  return (
    <div className={`relative flex flex-col ${sidebarOpened ? 'pl-4' : ''} pr-4`}>
      {/* {isLoading && (
        <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform`}>
          <LoadingSpinner size={48} />
        </div>
      )} */}

      <div className="mt-4 flex w-full items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <ModeToggle />
      </div>
      <FadeIn className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dashboard.photos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Albums</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dashboard.albums}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dashboard.users}</p>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

export default Page;
