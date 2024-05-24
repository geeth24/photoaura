import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {

  const { pathname } = request.nextUrl;

  // Check if the request starts with /api
  if (pathname.startsWith('/api')) {
    // Modify the hostname for API requests
    const url = request.nextUrl.clone();
    url.hostname = 'aura-api.reactiveshots.com';

    // Redirect the request to the new domain while preserving the path and query
    return NextResponse.redirect(url);
  }

  // For other paths, no action is taken
  return NextResponse.next();
}
