import { NextResponse, type NextRequest } from "next/server"
import { APP_STORE, PLAY_STORE } from "@/lib/stores"

// one link for emails and anywhere else a single url fits: phones go to their store
export function GET(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? ""
  const target = /android/i.test(ua)
    ? PLAY_STORE
    : /iPhone|iPad|iPod/.test(ua)
      ? APP_STORE
      : new URL("/#clients", request.url)

  const res = NextResponse.redirect(target, 302)
  res.headers.set("Cache-Control", "private, no-store")
  res.headers.set("Vary", "User-Agent")
  return res
}
