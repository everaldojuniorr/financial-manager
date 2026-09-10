export type TransactionType = "entrada" | "saida"

export type PaymentMethod =
  | "pix"
  | "debito"
  | "credito"
  | "dinheiro"
  | "boleto"
  | "transferencia"

export type InvoiceStatus = "aberta" | "fechada" | "paga"

/**
 * Distinguishes spending you cannot cut this month from spending you can,
 * which is what makes the budget panel actionable instead of merely descriptive.
 */
export type CategoryKind = "essencial" | "variavel" | "investimento" | "receita"

export type Category = {
  id: string
  name: string
  kind: CategoryKind
  type: TransactionType
  color: string
  monthlyBudget: number
}

export type Transaction = {
  id: string
  date: string
  description: string
  categoryId: string
  method: PaymentMethod
  amount: number
  type: TransactionType
  tag: string
  note: string
  recurring: boolean
  /** Set when this row is the cash payment of a credit-card invoice. */
  invoiceId?: string | null
}

export type NewTransaction = Omit<Transaction, "id">

export type Invoice = {
  id: string
  label: string
  /** Billing cycle as YYYY-MM. */
  competence: string
  dueDate: string
  status: InvoiceStatus
  paidAt: string | null
  paymentTransactionId: string | null
}

export type NewInvoice = {
  label: string
  competence: string
  dueDate: string
  status?: InvoiceStatus
}

export type Installment = {
  current: number
  total: number
}

export type InvoiceItem = {
  id: string
  invoiceId: string
  description: string
  categoryId: string
  amount: number
  installment: Installment
  tag: string
}

export type NewInvoiceItem = Omit<InvoiceItem, "id">

export type InvoiceWithTotal = Invoice & {
  total: number
  itemCount: number
}

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "pix", label: "Pix" },
  { id: "debito", label: "Débito" },
  { id: "credito", label: "Crédito" },
  { id: "dinheiro", label: "Dinheiro" },
  { id: "boleto", label: "Boleto" },
  { id: "transferencia", label: "Transferência" },
]

/** Methods that move cash immediately — credit belongs on an invoice instead. */
export const CASH_PAYMENT_METHODS = PAYMENT_METHODS.filter((m) => m.id !== "credito")

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  aberta: "Aberta",
  fechada: "Fechada",
  paga: "Paga",
}

export const CATEGORY_KIND_LABEL: Record<CategoryKind, string> = {
  essencial: "Essencial",
  variavel: "Variável",
  investimento: "Investimento",
  receita: "Receita",
}
