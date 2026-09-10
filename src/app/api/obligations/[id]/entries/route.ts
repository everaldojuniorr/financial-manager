import { NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth"
import { parseObligationEntryInput } from "@/lib/obligation-validation"
import { upsertObligationEntry } from "@/lib/obligation-store"

export const dynamic = "force-dynamic"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if ("error" in auth) return auth.error

  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ errors: ["JSON inválido."] }, { status: 400 })
  }

  const parsed = parseObligationEntryInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 422 })
  }

  try {
    const entry = await upsertObligationEntry(auth.userId, id, parsed.value)
    return NextResponse.json({ entry })
  } catch (error) {
    return NextResponse.json(
      {
        errors: [
          error instanceof Error ? error.message : "Não foi possível salvar o mês.",
        ],
      },
      { status: 422 }
    )
  }
}
