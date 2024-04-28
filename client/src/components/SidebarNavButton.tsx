import Link from 'next/link';
import React from 'react';
interface SidebarNavButtonProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
  open?: boolean;
  onClick?: () => void;
}

function SidebarNavButton({ icon, label, href, active, open, onClick }: SidebarNavButtonProps) {
  return (
    <Link
      className={`flex w-full items-center  justify-start p-2 ${active ? 'bg-primary' : 'hover:bg-primary/10 '} ${open ? 'p-[0.55rem]' : 'p-[0.85rem]'} rounded-md transition-all duration-500`}
      href={href}
      onClick={onClick}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className={`h-6 w-6 ${active ? 'text-secondary-foreground' : 'text-primary'}`}
      >
        {icon}
      </svg>
      <h1
        className={`${open ? 'hidden' : 'flex'} ${active ? 'text-secondary-foreground' : 'text-primary'} ml-[0.90rem] text-base font-semibold `}
      >
        {label}
      </h1>
    </Link>
  );
}

export default SidebarNavButton;
