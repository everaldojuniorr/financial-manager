import { NextResponse } from "next/server"

import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function POST() {
  const response = new NextResponse(null, { status: 204 })
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  })
  return response
}
