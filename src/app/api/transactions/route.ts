import { NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth"
import { CATEGORIES } from "@/lib/categories"
import {
  createTransaction,
  listInvoiceItems,
  listInvoices,
  listTransactions,
} from "@/lib/store"
import { parseTransactionInput } from "@/lib/validation"

export const dynamic = "force-dynamic"

export async function GET() {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  const invoices = listInvoices()
  const invoiceItems = invoices.flatMap((invoice) => listInvoiceItems(invoice.id))

  return NextResponse.json({
    transactions: listTransactions(),
    invoices,
    invoiceItems,
    categories: CATEGORIES,
    generatedAt: new Date().toISOString(),
  })
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

  const parsed = parseTransactionInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 422 })
  }

  return NextResponse.json(
    { transaction: createTransaction(parsed.value) },
    { status: 201 }
  )
}
