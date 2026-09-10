import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { hasSessionCookieShape, SESSION_COOKIE_NAME } from "@/lib/auth"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const authenticated = hasSessionCookieShape(token)

  const isLoginPage = pathname === "/login"
  const isLoginApi = pathname === "/api/auth/login"
  const isLogoutApi = pathname === "/api/auth/logout"
  const isPublic = isLoginPage || isLoginApi || isLogoutApi

  if (!authenticated && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ errors: ["Não autenticado."] }, { status: 401 })
    }
    const loginUrl = new URL("/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (authenticated && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
