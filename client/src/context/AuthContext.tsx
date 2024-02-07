'use client';
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { toast } from 'sonner';
import { setCookie, getCookie, deleteCookie } from 'cookies-next';
import { usePathname, useRouter } from 'next/navigation';
import ProtectedRoute from './ProtectedRoute';
import { Jwt } from 'jsonwebtoken';

interface CustomJwt {
  exp: number;
  // Include other properties from the JWT you might need
  iat?: number;
  // Add any other properties as per your token's structure
}

// Define the type for the user (adjust according to your needs)
type UserType = {
  id: string;
  user_name: string;
  full_name: string;
  user_email: string;
  // other user properties
};

// Define the shape of the context
interface AuthContextType {
  user: UserType | null;
  accessToken: string | null;
  login: (username: string, password: string) => void;
  logout: () => void;
  isLoading: boolean;
  sidebarOpened: boolean;
  setSidebarOpened: (value: boolean) => void;
}

// Creating the context with a default value
const AuthContext = createContext<AuthContextType | null>(null);

// AuthProvider props type
type AuthProviderProps = {
  children: ReactNode;
};

const noAuthRoutes = ['/login', '/'];

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserType | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sidebarOpened, setSidebarOpened] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  const login = async (username: string, password: string) => {
    try {
      // console.log(`${process.env.NEXT_PUBLIC_API_URL}/login`);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username,
          password,
        }),
      });

      const data = await response.json(); // Always parse the JSON first

      if (!response.ok) {
        // Check if the response JSON has a 'detail' field and use it for the message
        const errorMessage = data.detail || 'Login failed';
        // console.log('Login failed:', errorMessage);
        toast.error(errorMessage);
        return; // Exit early as the login failed
      }

      setAccessToken(data.access_token);
      setUser(data.user);
      // console.log('Login success:', data);
      toast.success('Welcome Back, ' + data.user.full_name + '!');
      setCookie('token', data.access_token, {
        path: '/',
        maxAge: 3600, // Expires after 1hr
        sameSite: true,
      });

      // Store the user details in local storage
      setCookie('user', JSON.stringify(data.user), {
        path: '/',
        maxAge: 3600, // Expires after 1hr
        sameSite: true,
      });

      // Redirect the user to the home page after successful login
      router.push('/admin/photos');
    } catch (error) {
      console.error('Login error:', error);
      // Use a more generic error message if the error is not from the response
      toast.error('An error occurred during login.');
    }
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    deleteCookie('token');
    deleteCookie('user');
  };

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkTokenExpiration = () => {
      const token = getCookie('token');
      if (token) {
        const decodedToken = JSON.parse(atob(token.split('.')[1])) as CustomJwt;
        const expirationTime = decodedToken.exp * 1000; // Convert to milliseconds
        const currentTime = new Date().getTime();
        if (expirationTime < currentTime) {
          // console.log('Token expired');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          deleteCookie('token');
          deleteCookie('user');
          toast.error('Session expired. Please log in again.');
          router.push('/login');
        } else {
          // console.log('Token still valid not loggin out');
          const storedUser = getCookie('user');
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
          }
        }
      }
      setIsLoading(false);
    };

    // Check token expiration on initial load
    checkTokenExpiration();

    // Set an interval to check token expiration periodically, e.g., every 5 min
    const intervalId = setInterval(checkTokenExpiration, 300000); // 5 min

    // Clear the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, [router]);

  useEffect(() => {
    //set sidebar state
    const storedSidebarState = localStorage.getItem('sidebarOpened');
    if (storedSidebarState) {
      setSidebarOpened(JSON.parse(storedSidebarState));
    }
  }, [router]);

  const saveSidebarState = (value: boolean) => {
    setSidebarOpened(value);
    localStorage.setItem('sidebarOpened', JSON.stringify(value));
  };
  const isNoAuthRoute = pathname.startsWith('/share') || noAuthRoutes.includes(pathname);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        login,
        logout,
        isLoading,
        sidebarOpened,
        setSidebarOpened: saveSidebarState,
      }}
    >
      {isNoAuthRoute ? <>{children}</> : <ProtectedRoute>{children}</ProtectedRoute>}
    </AuthContext.Provider>
  );
};

// Custom hook for using the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
