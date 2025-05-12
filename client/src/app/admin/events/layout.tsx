'use client';

import React from 'react';

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-full w-full bg-background p-4 text-foreground">{children}</div>;
}
