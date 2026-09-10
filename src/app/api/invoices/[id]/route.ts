import { NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth"
import { deleteInvoice, getInvoice, listInvoiceItems } from "@/lib/store"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  const { id } = await params
  const invoice = getInvoice(id)
  if (!invoice) {
    return NextResponse.json({ errors: ["Fatura não encontrada."] }, { status: 404 })
  }
  return NextResponse.json({ invoice, items: listInvoiceItems(id) })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  const { id } = await params
  if (!deleteInvoice(id)) {
    return NextResponse.json(
      { errors: ["Fatura não encontrada ou já paga."] },
      { status: 404 }
    )
  }
  return new NextResponse(null, { status: 204 })
}
