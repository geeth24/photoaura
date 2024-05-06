'use client';

import React from 'react';
import SidebarNavButton from '@/components/SidebarNavButton';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathName = usePathname();
  const { sidebarOpened, setSidebarOpened, logout, user } = useAuth();

  // //if command s is pressed, toggle sidebar
  // useEffect(() => {
  //   const handleKeyPress = (e: KeyboardEvent) => {
  //     if (e.key === 's' && e.metaKey) {
  //       //if open, close, if closed, open
  //       if (sidebarOpened) {
  //         setSidebarOpened(false);
  //       } else {
  //         setSidebarOpened(true);
  //       }
  //     }
  //   };
  //   window.addEventListener('keydown', handleKeyPress);
  //   return () => {
  //     window.removeEventListener('keydown', handleKeyPress);
  //   };
  // }, [sidebarOpened, setSidebarOpened]);

  return (
    <div className='relative h-full'>
      <div className="absolute h-full w-full bg-gradient-to-t from-transparent via-primary/30 to-transparent" />
      <div className="flex">
        <div
          className={`${sidebarOpened ? '' : 'w-[45%] md:w-[23.5%] lg:w-1/5'} fixed h-screen min-w-14 flex-col justify-between bg-secondary transition-all duration-500`}
          style={{ zIndex: 10 }}
        >
          <div className="flex h-screen flex-col justify-between">
            <div>
              <div
                className={`bg- flex h-fit w-full items-start justify-between p-2 ${sidebarOpened ? '' : 'pl-4'} transition-all duration-500`}
              >
                <div className="flex items-center justify-center">
                  <Image
                    src="/images/logo.png"
                    alt="PhotoAura Logo"
                    width={500}
                    height={500}
                    className={`${sidebarOpened ? 'ml-[0.13rem]' : ''} h-10 w-10 cursor-pointer rounded-full  bg-primary p-1`}
                    onClick={() => setSidebarOpened(!sidebarOpened)}
                  />

                  <h1
                    className={`${sidebarOpened ? 'hidden' : 'flex'} ml-2 text-xl font-bold transition-all duration-500`}
                  >
                    PhotoAura
                  </h1>
                </div>
              </div>
              <div className="space-y-2 p-2">
                <SidebarNavButton
                  icon={
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
                    />
                  }
                  label="Dashboard"
                  href="/admin/dashboard"
                  open={sidebarOpened}
                  active={pathName === '/admin/dashboard'}
                />
                <SidebarNavButton
                  icon={
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                    />
                  }
                  label="Photos"
                  href="/admin/photos"
                  open={sidebarOpened}
                  active={pathName === '/admin/photos'}
                />
                <SidebarNavButton
                  icon={
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z"
                    />
                  }
                  label="Albums"
                  href="/admin/albums"
                  open={sidebarOpened}
                  active={pathName.startsWith('/admin/albums')}
                />
                {parseInt(user?.id ?? '') === 1 && (
                  <SidebarNavButton
                    icon={
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
                      />
                    }
                    label="Users"
                    href="/admin/users"
                    open={sidebarOpened}
                    active={pathName === '/admin/users'}
                  />
                )}
              </div>
            </div>
            <div className="space-y-2 p-2">
              <SidebarNavButton
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12a7.5 7.5 0 0 0 15 0m-15 0a7.5 7.5 0 1 1 15 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077 1.41-.513m14.095-5.13 1.41-.513M5.106 17.785l1.15-.964m11.49-9.642 1.149-.964M7.501 19.795l.75-1.3m7.5-12.99.75-1.3m-6.063 16.658.26-1.477m2.605-14.772.26-1.477m0 17.726-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205 12 12m6.894 5.785-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495"
                  />
                }
                label="Settings"
                href="/admin/settings"
                open={sidebarOpened}
                active={pathName === '/admin/settings'}
              />
              <SidebarNavButton
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15"
                  />
                }
                label="Logout"
                href="/"
                open={sidebarOpened}
                onClick={() => logout()}
              />
            </div>
          </div>
        </div>
        <div
          className={`ml-auto w-full ${sidebarOpened ? 'pl-14' : 'pl-[50%] md:pl-[25%] lg:pl-[21%]'} transition-all duration-500`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
