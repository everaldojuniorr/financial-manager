import fs from "node:fs"
import path from "node:path"

import { buildSeedInvoices } from "./invoice-seed"
import {
  isLedgerFile,
  normalizeLedger,
  nextInvoiceIdFrom,
  nextInvoiceItemIdFrom,
  nextTransactionIdFrom,
  type LedgerFile,
} from "./ledger-file"
import { buildLedger } from "./seed"
import type {
  Invoice,
  InvoiceItem,
  InvoiceWithTotal,
  NewInvoice,
  NewInvoiceItem,
  NewTransaction,
  PaymentMethod,
  Transaction,
} from "./types"

const DATA_DIR = path.join(process.cwd(), "data")
const LEDGER_PATH = path.join(DATA_DIR, "ledger.json")
const LEDGER_TMP_PATH = path.join(DATA_DIR, "ledger.json.tmp")

const globalCache = globalThis as unknown as { __ledger?: LedgerFile }

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function sortTransactions(transactions: Transaction[]) {
  return [...transactions].sort((a, b) =>
    a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)
  )
}

function sortInvoices(invoices: Invoice[]) {
  return [...invoices].sort((a, b) =>
    a.competence === b.competence
      ? b.dueDate.localeCompare(a.dueDate)
      : b.competence.localeCompare(a.competence)
  )
}

function invoiceTotal(store: LedgerFile, invoiceId: string) {
  return store.invoiceItems
    .filter((item) => item.invoiceId === invoiceId)
    .reduce((sum, item) => sum + item.amount, 0)
}

function seedLedger(): LedgerFile {
  const transactions = buildLedger()
  const { invoices, invoiceItems } = buildSeedInvoices()

  const ledger: LedgerFile = {
    version: 1,
    transactions,
    nextTransactionId: nextTransactionIdFrom(transactions),
    invoices,
    invoiceItems,
    nextInvoiceId: nextInvoiceIdFrom(invoices),
    nextInvoiceItemId: nextInvoiceItemIdFrom(invoiceItems),
  }

  // Back-fill the demo payment for the closed August invoice.
  const paid = invoices.find((invoice) => invoice.status === "paga")
  if (paid) {
    const total = invoiceItems
      .filter((item) => item.invoiceId === paid.id)
      .reduce((sum, item) => sum + item.amount, 0)
    const payment: Transaction = {
      id: `tx_${ledger.nextTransactionId.toString().padStart(4, "0")}`,
      date: paid.paidAt ?? paid.dueDate,
      description: `Pagamento fatura ${paid.label} · ${formatCompetenceLabel(paid.competence)}`,
      categoryId: "taxas",
      method: "pix",
      amount: total,
      type: "saida",
      tag: "cartao",
      note: "",
      recurring: false,
      invoiceId: paid.id,
    }
    ledger.transactions = sortTransactions([payment, ...ledger.transactions])
    ledger.nextTransactionId += 1
    paid.paymentTransactionId = payment.id
  }

  return ledger
}

function formatCompetenceLabel(competence: string) {
  const [year, month] = competence.split("-").map(Number)
  const label = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(
    new Date(year, month - 1, 1)
  )
  return label.charAt(0).toUpperCase() + label.slice(1).replace(".", "")
}

function writeLedgerToDisk(ledger: LedgerFile) {
  ensureDataDir()
  const payload = `${JSON.stringify(ledger, null, 2)}\n`
  fs.writeFileSync(LEDGER_TMP_PATH, payload, "utf8")
  fs.renameSync(LEDGER_TMP_PATH, LEDGER_PATH)
}

function readLedgerFromDisk(): LedgerFile {
  ensureDataDir()

  if (!fs.existsSync(LEDGER_PATH)) {
    const seeded = seedLedger()
    writeLedgerToDisk(seeded)
    return seeded
  }

  try {
    const raw = fs.readFileSync(LEDGER_PATH, "utf8")
    const parsed: unknown = JSON.parse(raw)
    if (!isLedgerFile(parsed)) {
      throw new Error("Ledger file has an unexpected shape.")
    }
    const normalized = normalizeLedger(parsed)
    const ledger = ensureDemoInvoices(normalized)
    if (normalized.invoices.length === 0 && ledger.invoices.length > 0) {
      writeLedgerToDisk(ledger)
    }
    return ledger
  } catch (error) {
    const backupPath = `${LEDGER_PATH}.corrupt-${Date.now()}.json`
    try {
      fs.copyFileSync(LEDGER_PATH, backupPath)
    } catch {
      // Nothing to back up.
    }
    console.error(
      "[ledger] Failed to read ledger.json; re-seeding. Backup:",
      backupPath,
      error
    )
    const seeded = seedLedger()
    writeLedgerToDisk(seeded)
    return seeded
  }
}

/** Older ledgers from stage 1 have no invoices — attach the demo set once. */
function ensureDemoInvoices(ledger: LedgerFile): LedgerFile {
  if (ledger.invoices.length > 0) return ledger

  const { invoices, invoiceItems } = buildSeedInvoices()
  const next: LedgerFile = {
    ...ledger,
    invoices,
    invoiceItems,
    nextInvoiceId: nextInvoiceIdFrom(invoices),
    nextInvoiceItemId: nextInvoiceItemIdFrom(invoiceItems),
  }

  const paid = invoices.find((invoice) => invoice.status === "paga")
  if (paid) {
    const total = invoiceItems
      .filter((item) => item.invoiceId === paid.id)
      .reduce((sum, item) => sum + item.amount, 0)
    const payment: Transaction = {
      id: `tx_${next.nextTransactionId.toString().padStart(4, "0")}`,
      date: paid.paidAt ?? paid.dueDate,
      description: `Pagamento fatura ${paid.label} · ${formatCompetenceLabel(paid.competence)}`,
      categoryId: "taxas",
      method: "pix",
      amount: total,
      type: "saida",
      tag: "cartao",
      note: "",
      recurring: false,
      invoiceId: paid.id,
    }
    next.transactions = sortTransactions([payment, ...next.transactions])
    next.nextTransactionId += 1
    paid.paymentTransactionId = payment.id
  }

  return next
}

function cache(): LedgerFile {
  if (!globalCache.__ledger) {
    globalCache.__ledger = readLedgerFromDisk()
  }
  return globalCache.__ledger
}

function persist() {
  writeLedgerToDisk(cache())
}

export function getLedgerPath() {
  return LEDGER_PATH
}

export function listTransactions(): Transaction[] {
  return cache().transactions
}

export function listInvoices(): InvoiceWithTotal[] {
  const store = cache()
  return sortInvoices(store.invoices).map((invoice) => ({
    ...invoice,
    total: invoiceTotal(store, invoice.id),
    itemCount: store.invoiceItems.filter((item) => item.invoiceId === invoice.id).length,
  }))
}

export function getInvoice(id: string): InvoiceWithTotal | null {
  const store = cache()
  const invoice = store.invoices.find((row) => row.id === id)
  if (!invoice) return null
  return {
    ...invoice,
    total: invoiceTotal(store, id),
    itemCount: store.invoiceItems.filter((item) => item.invoiceId === id).length,
  }
}

export function listInvoiceItems(invoiceId: string): InvoiceItem[] {
  return cache()
    .invoiceItems.filter((item) => item.invoiceId === invoiceId)
    .sort((a, b) => b.amount - a.amount)
}

export function createTransaction(input: NewTransaction): Transaction {
  const store = cache()
  const transaction: Transaction = {
    ...input,
    invoiceId: input.invoiceId ?? null,
    id: `tx_${(store.nextTransactionId++).toString().padStart(4, "0")}`,
  }
  store.transactions = sortTransactions([transaction, ...store.transactions])
  persist()
  return transaction
}

export function createInvoice(input: NewInvoice): InvoiceWithTotal {
  const store = cache()
  const duplicate = store.invoices.some(
    (invoice) =>
      invoice.label.toLowerCase() === input.label.trim().toLowerCase() &&
      invoice.competence === input.competence
  )
  if (duplicate) {
    throw new Error("Já existe uma fatura com este cartão e competência.")
  }

  const invoice: Invoice = {
    id: `inv_${(store.nextInvoiceId++).toString().padStart(4, "0")}`,
    label: input.label.trim(),
    competence: input.competence,
    dueDate: input.dueDate,
    status: input.status ?? "aberta",
    paidAt: null,
    paymentTransactionId: null,
  }
  store.invoices = sortInvoices([invoice, ...store.invoices])
  persist()
  return { ...invoice, total: 0, itemCount: 0 }
}

export function updateInvoiceStatus(
  id: string,
  status: Invoice["status"]
): InvoiceWithTotal | null {
  const store = cache()
  const index = store.invoices.findIndex((invoice) => invoice.id === id)
  if (index === -1) return null
  store.invoices[index] = { ...store.invoices[index], status }
  persist()
  return getInvoice(id)
}

export function deleteInvoice(id: string): boolean {
  const store = cache()
  const invoice = store.invoices.find((row) => row.id === id)
  if (!invoice || invoice.status === "paga") return false
  store.invoices = store.invoices.filter((row) => row.id !== id)
  store.invoiceItems = store.invoiceItems.filter((item) => item.invoiceId !== id)
  persist()
  return true
}

export function createInvoiceItem(input: NewInvoiceItem): InvoiceItem {
  const store = cache()
  const invoice = store.invoices.find((row) => row.id === input.invoiceId)
  if (!invoice) throw new Error("Fatura não encontrada.")
  if (invoice.status === "paga") {
    throw new Error("Não é possível alterar uma fatura já paga.")
  }

  const item: InvoiceItem = {
    ...input,
    id: `ii_${(store.nextInvoiceItemId++).toString().padStart(4, "0")}`,
  }
  store.invoiceItems.push(item)
  persist()
  return item
}

export function updateInvoiceItem(
  id: string,
  patch: Partial<NewInvoiceItem>
): InvoiceItem | null {
  const store = cache()
  const index = store.invoiceItems.findIndex((item) => item.id === id)
  if (index === -1) return null
  const invoice = store.invoices.find((row) => row.id === store.invoiceItems[index].invoiceId)
  if (!invoice || invoice.status === "paga") return null

  const updated = { ...store.invoiceItems[index], ...patch, id }
  store.invoiceItems[index] = updated
  persist()
  return updated
}

export function deleteInvoiceItem(id: string): boolean {
  const store = cache()
  const item = store.invoiceItems.find((row) => row.id === id)
  if (!item) return false
  const invoice = store.invoices.find((row) => row.id === item.invoiceId)
  if (!invoice || invoice.status === "paga") return false
  store.invoiceItems = store.invoiceItems.filter((row) => row.id !== id)
  persist()
  return true
}

export function payInvoice(
  id: string,
  input: { paidAt: string; method: PaymentMethod }
): { invoice: InvoiceWithTotal; transaction: Transaction } | null {
  const store = cache()
  const index = store.invoices.findIndex((invoice) => invoice.id === id)
  if (index === -1) return null

  const invoice = store.invoices[index]
  if (invoice.status === "paga") return null

  const total = invoiceTotal(store, id)
  if (total <= 0) {
    throw new Error("Adicione compras à fatura antes de registrar o pagamento.")
  }

  const transaction = createTransaction({
    date: input.paidAt,
    description: `Pagamento fatura ${invoice.label} · ${formatCompetenceLabel(invoice.competence)}`,
    categoryId: "taxas",
    method: input.method,
    amount: total,
    type: "saida",
    tag: "cartao",
    note: "",
    recurring: false,
    invoiceId: invoice.id,
  })

  store.invoices[index] = {
    ...invoice,
    status: "paga",
    paidAt: input.paidAt,
    paymentTransactionId: transaction.id,
  }
  persist()

  const updated = getInvoice(id)
  return updated ? { invoice: updated, transaction } : null
}

export function updateTransaction(
  id: string,
  patch: Partial<NewTransaction>
): Transaction | null {
  const store = cache()
  const index = store.transactions.findIndex((t) => t.id === id)
  if (index === -1) return null
  if (store.transactions[index].invoiceId) return null
  const updated = { ...store.transactions[index], ...patch, id }
  store.transactions[index] = updated
  store.transactions = sortTransactions(store.transactions)
  persist()
  return updated
}

export function deleteTransaction(id: string): boolean {
  const store = cache()
  const transaction = store.transactions.find((t) => t.id === id)
  if (!transaction) return false
  if (transaction.invoiceId) return false

  store.transactions = store.transactions.filter((t) => t.id !== id)
  persist()
  return true
}
