import { NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth"
import { parseObligationPatch } from "@/lib/obligation-validation"
import { deactivateObligation, updateObligation } from "@/lib/obligation-store"

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

  const parsed = parseObligationPatch(body)
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 422 })
  }

  const obligation = await updateObligation(auth.userId, id, parsed.value)
  if (!obligation) {
    return NextResponse.json({ errors: ["Dívida não encontrada."] }, { status: 404 })
  }
  return NextResponse.json({ obligation })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if ("error" in auth) return auth.error

  const { id } = await params
  if (!(await deactivateObligation(auth.userId, id))) {
    return NextResponse.json({ errors: ["Dívida não encontrada."] }, { status: 404 })
  }
  return new NextResponse(null, { status: 204 })
}
