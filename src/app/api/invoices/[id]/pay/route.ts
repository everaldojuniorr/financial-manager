import { NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth"
import { parsePayInvoiceInput } from "@/lib/invoice-validation"
import { payInvoice } from "@/lib/store"

export const dynamic = "force-dynamic"

export async function POST(
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

  const parsed = parsePayInvoiceInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 422 })
  }

  try {
    const result = payInvoice(id, parsed.value)
    if (!result) {
      return NextResponse.json({ errors: ["Fatura não encontrada ou já paga."] }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        errors: [
          error instanceof Error ? error.message : "Não foi possível registrar o pagamento.",
        ],
      },
      { status: 422 }
    )
  }
}
