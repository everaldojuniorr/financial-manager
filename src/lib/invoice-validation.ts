import { CATEGORY_MAP } from "./categories"
import { CASH_PAYMENT_METHODS } from "./types"
import type { NewInvoice, NewInvoiceItem, PaymentMethod } from "./types"

const COMPETENCE = /^\d{4}-\d{2}$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CASH_METHODS = new Set(CASH_PAYMENT_METHODS.map((m) => m.id))

export function parseInvoiceInput(raw: unknown) {
  const errors: string[] = []
  if (typeof raw !== "object" || raw === null) {
    return { ok: false as const, errors: ["Corpo da requisição inválido."] }
  }
  const body = raw as Record<string, unknown>
  const label = typeof body.label === "string" ? body.label.trim() : ""
  const competence = typeof body.competence === "string" ? body.competence : ""
  const dueDate = typeof body.dueDate === "string" ? body.dueDate : ""

  if (label.length < 2) errors.push("Informe o nome do cartão.")
  if (!COMPETENCE.test(competence)) errors.push("Competência inválida (use AAAA-MM).")
  if (!ISO_DATE.test(dueDate)) errors.push("Informe um vencimento válido.")

  if (errors.length) return { ok: false as const, errors }

  const value: NewInvoice = { label, competence, dueDate }
  if (body.status === "aberta" || body.status === "fechada" || body.status === "paga") {
    value.status = body.status
  }
  return { ok: true as const, value }
}

export function parseInvoiceItemInput(raw: unknown) {
  const errors: string[] = []
  if (typeof raw !== "object" || raw === null) {
    return { ok: false as const, errors: ["Corpo da requisição inválido."] }
  }
  const body = raw as Record<string, unknown>
  const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId : ""
  const description = typeof body.description === "string" ? body.description.trim() : ""
  const categoryId = typeof body.categoryId === "string" ? body.categoryId : ""
  const amount = Number(body.amount)
  const current = Number(body.installmentCurrent ?? body.current)
  const total = Number(body.installmentTotal ?? body.total)

  if (!invoiceId) errors.push("Fatura não informada.")
  if (description.length < 2) errors.push("Informe uma descrição.")
  if (!CATEGORY_MAP.get(categoryId) || CATEGORY_MAP.get(categoryId)?.type !== "saida") {
    errors.push("Escolha uma categoria de saída.")
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push("O valor precisa ser maior que zero.")
  }
  if (!Number.isInteger(current) || !Number.isInteger(total) || current < 1 || total < 1) {
    errors.push("Informe parcelas válidas (ex.: 5 e 12).")
  } else if (current > total) {
    errors.push("A parcela atual não pode ser maior que o total.")
  }

  if (errors.length) return { ok: false as const, errors }

  const value: NewInvoiceItem = {
    invoiceId,
    description,
    categoryId,
    amount: Math.round(amount * 100) / 100,
    installment: { current, total },
    tag: typeof body.tag === "string" ? body.tag.trim().slice(0, 24) : "",
  }
  return { ok: true as const, value }
}

export function parseStatedTotalInput(raw: unknown) {
  const errors: string[] = []
  if (typeof raw !== "object" || raw === null) {
    return { ok: false as const, errors: ["Corpo da requisição inválido."] }
  }
  const body = raw as Record<string, unknown>
  if (!("statedTotal" in body)) {
    return { ok: false as const, errors: ["Informe o valor final da fatura."] }
  }
  if (body.statedTotal === null || body.statedTotal === "") {
    return { ok: true as const, value: { statedTotal: null as number | null } }
  }
  const amount = Number(body.statedTotal)
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push("O valor final precisa ser maior que zero, ou fique em branco para limpar.")
  }
  if (errors.length) return { ok: false as const, errors }
  return {
    ok: true as const,
    value: { statedTotal: Math.round(amount * 100) / 100 },
  }
}

export function parsePayInvoiceInput(raw: unknown) {
  const errors: string[] = []
  if (typeof raw !== "object" || raw === null) {
    return { ok: false as const, errors: ["Corpo da requisição inválido."] }
  }
  const body = raw as Record<string, unknown>
  const paidAt = typeof body.paidAt === "string" ? body.paidAt : ""
  const method = body.method as PaymentMethod

  if (!ISO_DATE.test(paidAt)) errors.push("Informe a data do pagamento.")
  if (!CASH_METHODS.has(method)) {
    errors.push("Use Pix, boleto, débito ou transferência para pagar a fatura.")
  }
  if (errors.length) return { ok: false as const, errors }
  return { ok: true as const, value: { paidAt, method } }
}
