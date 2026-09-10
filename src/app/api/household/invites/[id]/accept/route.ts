import { NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth"
import { respondToInvite } from "@/lib/household"

export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if ("error" in auth) return auth.error

  const { id } = await params
  const result = await respondToInvite(auth.userId, id, true)
  if (!result.ok) {
    return NextResponse.json({ errors: result.errors }, { status: 422 })
  }
  return NextResponse.json({ ok: true })
}
