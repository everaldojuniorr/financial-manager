import { config } from "dotenv"
config({ path: ".env.local" })
config()

import fs from "node:fs"
import path from "node:path"

import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"

import { getDb } from "../src/db/client"
import { invoiceItems, invoices, transactions, users } from "../src/db/schema"
import {
  isLedgerFile,
  normalizeLedger,
  type LedgerFile,
} from "../src/lib/ledger-file"

async function ensureAdmin() {
  const db = getDb()
  const username = process.env.SEED_USERNAME ?? "admin"
  const password = process.env.SEED_PASSWORD ?? "admin123"

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  if (existing) return existing

  const passwordHash = await bcrypt.hash(password, 12)
  const [created] = await db
    .insert(users)
    .values({ username, passwordHash })
    .returning()
  return created
}

async function importLedger(userId: string, ledger: LedgerFile) {
  const db = getDb()
  const invoiceIdMap = new Map<string, string>()
  const transactionIdMap = new Map<string, string>()

  for (const invoice of ledger.invoices) {
    const [row] = await db
      .insert(invoices)
      .values({
        userId,
        label: invoice.label,
        competence: invoice.competence,
        dueDate: invoice.dueDate,
        status: invoice.status,
        paidAt: invoice.paidAt,
        paymentTransactionId: null,
      })
      .returning()
    invoiceIdMap.set(invoice.id, row.id)
  }

  for (const item of ledger.invoiceItems) {
    const invoiceId = invoiceIdMap.get(item.invoiceId)
    if (!invoiceId) continue
    await db.insert(invoiceItems).values({
      userId,
      invoiceId,
      description: item.description,
      categoryId: item.categoryId,
      amount: item.amount,
      installmentCurrent: item.installment.current,
      installmentTotal: item.installment.total,
      tag: item.tag,
    })
  }

  for (const tx of ledger.transactions) {
    const [row] = await db
      .insert(transactions)
      .values({
        userId,
        date: tx.date,
        description: tx.description,
        categoryId: tx.categoryId,
        method: tx.method,
        amount: tx.amount,
        type: tx.type,
        tag: tx.tag,
        note: tx.note,
        recurring: tx.recurring,
        invoiceId: tx.invoiceId ? invoiceIdMap.get(tx.invoiceId) ?? null : null,
      })
      .returning()
    transactionIdMap.set(tx.id, row.id)
  }

  for (const invoice of ledger.invoices) {
    if (!invoice.paymentTransactionId) continue
    const newInvoiceId = invoiceIdMap.get(invoice.id)
    const newTxId = transactionIdMap.get(invoice.paymentTransactionId)
    if (!newInvoiceId || !newTxId) continue
    await db
      .update(invoices)
      .set({ paymentTransactionId: newTxId })
      .where(eq(invoices.id, newInvoiceId))
  }
}

async function main() {
  const ledgerPath = path.join(process.cwd(), "data", "ledger.json")
  if (!fs.existsSync(ledgerPath)) {
    console.error(`[import] Arquivo não encontrado: ${ledgerPath}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(ledgerPath, "utf8")
  const parsed: unknown = JSON.parse(raw)
  if (!isLedgerFile(parsed)) {
    console.error("[import] ledger.json inválido.")
    process.exit(1)
  }

  const ledger = normalizeLedger(parsed)
  const admin = await ensureAdmin()
  await importLedger(admin.id, ledger)
  console.log(
    `[import] Importado para ${admin.username}: ${ledger.transactions.length} lançamentos, ${ledger.invoices.length} faturas.`
  )
  const { getSql } = await import("../src/db/client")
  await getSql().end({ timeout: 5 })
  process.exit(0)
}

main().catch((error) => {
  console.error("[import] Falhou:", error)
  process.exit(1)
})
