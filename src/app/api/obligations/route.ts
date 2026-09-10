import { NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth"
import { parseObligationInput } from "@/lib/obligation-validation"
import {
  createObligation,
  ensureDefaultObligations,
  listObligationEntries,
  listObligations,
} from "@/lib/obligation-store"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAuth()
  if ("error" in auth) return auth.error

  await ensureDefaultObligations(auth.userId)
  return NextResponse.json({
    obligations: await listObligations(auth.userId),
    entries: await listObligationEntries(auth.userId),
  })
}

export async function POST(request: Request) {
  const auth = await requireAuth()
  if ("error" in auth) return auth.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ errors: ["JSON inválido."] }, { status: 400 })
  }

  const parsed = parseObligationInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 422 })
  }

  const obligation = await createObligation(auth.userId, parsed.value)
  return NextResponse.json({ obligation }, { status: 201 })
}
