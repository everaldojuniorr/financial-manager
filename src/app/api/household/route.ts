import { NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth"
import { getHouseholdForUser, listPendingInvites } from "@/lib/household"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAuth()
  if ("error" in auth) return auth.error

  const [household, invites] = await Promise.all([
    getHouseholdForUser(auth.userId),
    listPendingInvites(auth.userId),
  ])

  return NextResponse.json({ ...household, invites })
}
