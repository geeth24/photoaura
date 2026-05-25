import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  const token = request.cookies.get("token")?.value
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/albums") || pathname.startsWith("/photos") || pathname.startsWith("/users") || pathname.startsWith("/faces") || pathname.startsWith("/cms")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  if (pathname === "/login" && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/albums/:path*",
    "/photos/:path*",
    "/users/:path*",
    "/faces/:path*",
    "/cms/:path*",
    "/login",
  ],
}
