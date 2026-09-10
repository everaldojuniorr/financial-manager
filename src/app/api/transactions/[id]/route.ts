import { NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth"
import { deleteTransaction, updateTransaction } from "@/lib/store"
import { parseTransactionInput } from "@/lib/validation"

export const dynamic = "force-dynamic"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ errors: ["JSON inválido."] }, { status: 400 })
  }

  const parsed = parseTransactionInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 422 })
  }

  const updated = updateTransaction(id, parsed.value)
  if (!updated) {
    return NextResponse.json({ errors: ["Lançamento não encontrado."] }, { status: 404 })
  }

  return NextResponse.json({ transaction: updated })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  const { id } = await params

  if (!deleteTransaction(id)) {
    return NextResponse.json({ errors: ["Lançamento não encontrado."] }, { status: 404 })
  }

  return new NextResponse(null, { status: 204 })
}
