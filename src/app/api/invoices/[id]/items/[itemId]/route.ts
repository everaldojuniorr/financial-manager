import { NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth"
import { parseInvoiceItemInput } from "@/lib/invoice-validation"
import { deleteInvoiceItem, updateInvoiceItem } from "@/lib/store"

export const dynamic = "force-dynamic"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = await requireAuth()
  if ("error" in auth) return auth.error

  const { id, itemId } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ errors: ["JSON inválido."] }, { status: 400 })
  }

  const merged =
    typeof body === "object" && body !== null
      ? { ...(body as Record<string, unknown>), invoiceId: id }
      : body

  const parsed = parseInvoiceItemInput(merged)
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 422 })
  }

  const updated = await updateInvoiceItem(auth.userId, itemId, parsed.value)
  if (!updated) {
    return NextResponse.json({ errors: ["Compra não encontrada."] }, { status: 404 })
  }
  return NextResponse.json({ item: updated })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = await requireAuth()
  if ("error" in auth) return auth.error

  const { itemId } = await params
  if (!(await deleteInvoiceItem(auth.userId, itemId))) {
    return NextResponse.json({ errors: ["Compra não encontrada."] }, { status: 404 })
  }
  return new NextResponse(null, { status: 204 })
}
