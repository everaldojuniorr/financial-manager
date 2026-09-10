import { NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth"
import { parseInvoiceInput } from "@/lib/invoice-validation"
import { createInvoice, listInvoices } from "@/lib/store"

export const dynamic = "force-dynamic"

export async function GET() {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  return NextResponse.json({ invoices: listInvoices() })
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ errors: ["JSON inválido."] }, { status: 400 })
  }

  const parsed = parseInvoiceInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 422 })
  }

  try {
    const invoice = createInvoice(parsed.value)
    return NextResponse.json({ invoice }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        errors: [
          error instanceof Error ? error.message : "Não foi possível criar a fatura.",
        ],
      },
      { status: 422 }
    )
  }
}
