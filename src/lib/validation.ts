import { CATEGORY_MAP } from "./categories"
import { PAYMENT_METHODS } from "./types"
import type { NewTransaction, PaymentMethod, TransactionType } from "./types"

const METHOD_IDS = new Set(PAYMENT_METHODS.map((m) => m.id))
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export type ValidationResult =
  | { ok: true; value: NewTransaction }
  | { ok: false; errors: string[] }

export function parseTransactionInput(raw: unknown): ValidationResult {
  const errors: string[] = []
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["Corpo da requisição inválido."] }
  }

  const body = raw as Record<string, unknown>

  const description = typeof body.description === "string" ? body.description.trim() : ""
  if (description.length < 2) {
    errors.push("Informe uma descrição com pelo menos 2 caracteres.")
  }

  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push("O valor precisa ser um número maior que zero.")
  }

  const type = body.type as TransactionType
  if (type !== "entrada" && type !== "saida") {
    errors.push("O tipo precisa ser entrada ou saída.")
  }

  const categoryId = typeof body.categoryId === "string" ? body.categoryId : ""
  const category = CATEGORY_MAP.get(categoryId)
  if (!category) {
    errors.push("Categoria desconhecida.")
  } else if (type === "entrada" || type === "saida") {
    if (category.type !== type) {
      errors.push("A categoria escolhida não corresponde ao tipo do lançamento.")
    }
  }

  const method = body.method as PaymentMethod
  if (!METHOD_IDS.has(method)) {
    errors.push("Método de pagamento desconhecido.")
  } else if (method === "credito") {
    errors.push(
      "Compras no cartão devem ser lançadas dentro da fatura, não como saída avulsa."
    )
  }

  const date = typeof body.date === "string" ? body.date : ""
  if (!ISO_DATE.test(date)) {
    errors.push("Informe uma data válida.")
  }

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      date,
      description,
      categoryId,
      method,
      amount: Math.round(amount * 100) / 100,
      type,
      tag: typeof body.tag === "string" ? body.tag.trim().slice(0, 24) : "",
      note: typeof body.note === "string" ? body.note.trim().slice(0, 240) : "",
      recurring: body.recurring === true,
    },
  }
}
