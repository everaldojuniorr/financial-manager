import type { Invoice, InvoiceItem, Transaction } from "./types"

/** On-disk shape. Versioned so later fields can be added without a migration drama. */
export type LedgerFile = {
  version: 1
  transactions: Transaction[]
  nextTransactionId: number
  invoices: Invoice[]
  invoiceItems: InvoiceItem[]
  nextInvoiceId: number
  nextInvoiceItemId: number
}

export const LEDGER_VERSION = 1 as const

function hasTransactionShape(value: unknown): value is Transaction {
  if (typeof value !== "object" || value === null) return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === "string" &&
    typeof row.date === "string" &&
    typeof row.amount === "number"
  )
}

export function isLedgerFile(value: unknown): value is LedgerFile {
  if (typeof value !== "object" || value === null) return false
  const file = value as Record<string, unknown>
  if (file.version !== LEDGER_VERSION) return false
  if (!Array.isArray(file.transactions) || !file.transactions.every(hasTransactionShape)) {
    return false
  }
  if (typeof file.nextTransactionId !== "number" || file.nextTransactionId < 1) {
    return false
  }
  return true
}

/** Older ledgers may lack invoice collections — fill them in on read. */
export function normalizeLedger(file: LedgerFile): LedgerFile {
  return {
    version: 1,
    transactions: file.transactions,
    nextTransactionId: file.nextTransactionId,
    invoices: file.invoices ?? [],
    invoiceItems: file.invoiceItems ?? [],
    nextInvoiceId: file.nextInvoiceId ?? nextIdFrom(file.invoices ?? [], "inv"),
    nextInvoiceItemId:
      file.nextInvoiceItemId ?? nextIdFrom(file.invoiceItems ?? [], "ii"),
  }
}

export function nextTransactionIdFrom(transactions: Transaction[]) {
  return nextIdFrom(transactions, "tx")
}

export function nextInvoiceIdFrom(invoices: Invoice[]) {
  return nextIdFrom(invoices, "inv")
}

export function nextInvoiceItemIdFrom(items: InvoiceItem[]) {
  return nextIdFrom(items, "ii")
}

function nextIdFrom(rows: { id: string }[], prefix: string) {
  let max = 0
  const pattern = new RegExp(`^${prefix}_(\\d+)$`)
  for (const row of rows) {
    const match = pattern.exec(row.id)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return max + 1
}
