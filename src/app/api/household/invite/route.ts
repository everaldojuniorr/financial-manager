import { NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth"
import { inviteToHousehold } from "@/lib/household"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await requireAuth()
  if ("error" in auth) return auth.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ errors: ["JSON inválido."] }, { status: 400 })
  }

  const username =
    typeof body === "object" && body !== null && "username" in body
      ? String((body as { username: unknown }).username ?? "")
      : ""

  const result = await inviteToHousehold(auth.userId, username)
  if (!result.ok) {
    return NextResponse.json({ errors: result.errors }, { status: 422 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
