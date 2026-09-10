import { NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth"
import { parseCopyObligationsInput } from "@/lib/obligation-validation"
import { copyPreviousObligationEntries } from "@/lib/obligation-store"

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

  const parsed = parseCopyObligationsInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 422 })
  }

  try {
    const entries = await copyPreviousObligationEntries(
      auth.userId,
      parsed.value.kind,
      parsed.value.competence
    )
    return NextResponse.json({ entries })
  } catch (error) {
    return NextResponse.json(
      {
        errors: [
          error instanceof Error ? error.message : "Não foi possível copiar o mês.",
        ],
      },
      { status: 422 }
    )
  }
}
