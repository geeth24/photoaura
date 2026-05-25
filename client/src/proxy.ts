import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// best-effort role read from the JWT (edge runtime, base64url)
function roleFromToken(token?: string): string | null {
  if (!token) return null
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
    return JSON.parse(atob(part)).role ?? null
  } catch {
    return null
  }
}

const PROTECTED = ["/dashboard", "/albums", "/photos", "/users", "/faces", "/website", "/profile"]
const ADMIN_ONLY = ["/dashboard", "/users", "/faces", "/website"]

export function proxy(request: NextRequest) {
  const token = request.cookies.get("token")?.value
  const role = roleFromToken(token)
  const { pathname } = request.nextUrl

  if (PROTECTED.some((p) => pathname.startsWith(p))) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    // clients can't reach admin-only areas
    if (role === "client" && ADMIN_ONLY.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/albums", request.url))
    }
  }

  if (pathname === "/login" && token) {
    const home = role === "client" ? "/albums" : "/dashboard"
    return NextResponse.redirect(new URL(home, request.url))
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
    "/website/:path*",
    "/profile/:path*",
    "/login",
  ],
}
