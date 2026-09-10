import { NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth"
import { parseInvoiceItemInput } from "@/lib/invoice-validation"
import { createInvoiceItem } from "@/lib/store"

export const dynamic = "force-dynamic"

export async function POST(
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

  const merged =
    typeof body === "object" && body !== null
      ? { ...(body as Record<string, unknown>), invoiceId: id }
      : body

  const parsed = parseInvoiceItemInput(merged)
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 422 })
  }

  try {
    const item = await createInvoiceItem(auth.userId, parsed.value)
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        errors: [
          error instanceof Error ? error.message : "Não foi possível salvar a compra.",
        ],
      },
      { status: 422 }
    )
  }
}
