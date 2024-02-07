'use client';
import React, { useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useRouter } from 'next/navigation';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // console.log('user', user);
    // console.log('isLoading', isLoading);
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, router, isLoading]);

  if (!user) {
    return null;
  } else {
    return <>{children}</>;
  }
};

export default ProtectedRoute;
