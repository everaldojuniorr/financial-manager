import { NextResponse } from "next/server"

import { CATEGORIES } from "@/lib/categories"
import { requireAuth } from "@/lib/auth"
import {
  ensureDefaultObligations,
  listObligationEntries,
  listObligations,
} from "@/lib/obligation-store"
import {
  createTransaction,
  listInvoiceItems,
  listInvoices,
  listTransactions,
} from "@/lib/store"
import { parseTransactionInput } from "@/lib/validation"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAuth()
  if ("error" in auth) return auth.error

  await ensureDefaultObligations(auth.userId)
  const invoices = await listInvoices(auth.userId)
  const invoiceItems = (
    await Promise.all(invoices.map((invoice) => listInvoiceItems(auth.userId, invoice.id)))
  ).flat()

  return NextResponse.json({
    transactions: await listTransactions(auth.userId),
    invoices,
    invoiceItems,
    obligations: await listObligations(auth.userId),
    obligationEntries: await listObligationEntries(auth.userId),
    categories: CATEGORIES,
    generatedAt: new Date().toISOString(),
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

  const parsed = parseTransactionInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 422 })
  }

  return NextResponse.json(
    { transaction: await createTransaction(auth.userId, parsed.value) },
    { status: 201 }
  )
}
