import { NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth"
import { parseStatedTotalInput } from "@/lib/invoice-validation"
import { deleteInvoice, getInvoice, listInvoiceItems, setInvoiceStatedTotal } from "@/lib/store"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if ("error" in auth) return auth.error

  const { id } = await params
  const invoice = await getInvoice(auth.userId, id)
  if (!invoice) {
    return NextResponse.json({ errors: ["Fatura não encontrada."] }, { status: 404 })
  }
  return NextResponse.json({
    invoice,
    items: await listInvoiceItems(auth.userId, id),
  })
}

export async function PATCH(
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

  const parsed = parseStatedTotalInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 422 })
  }

  try {
    const invoice = await setInvoiceStatedTotal(auth.userId, id, parsed.value.statedTotal)
    return NextResponse.json({
      invoice,
      items: await listInvoiceItems(auth.userId, id),
    })
  } catch (error) {
    return NextResponse.json(
      {
        errors: [
          error instanceof Error ? error.message : "Não foi possível salvar o valor final.",
        ],
      },
      { status: 422 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if ("error" in auth) return auth.error

  const { id } = await params
  if (!(await deleteInvoice(auth.userId, id))) {
    return NextResponse.json(
      { errors: ["Fatura não encontrada ou já paga."] },
      { status: 404 }
    )
  }
  return new NextResponse(null, { status: 204 })
}
