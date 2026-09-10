import { config } from "dotenv"
config({ path: ".env.local" })
config()

import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"

import { getDb } from "../src/db/client"
import { invoiceItems, invoices, transactions, users } from "../src/db/schema"
import { buildSeedInvoices } from "../src/lib/invoice-seed"
import { ensureDefaultObligations } from "../src/lib/obligation-store"
import { buildLedger } from "../src/lib/seed"

function formatCompetenceLabel(competence: string) {
  const [year, month] = competence.split("-").map(Number)
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, 1))
  return label.charAt(0).toUpperCase() + label.slice(1).replace(".", "")
}

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

  console.log(`[seed] Usuário criado: ${username}`)
  return created
}

async function seedDemoIfEmpty(userId: string) {
  const db = getDb()
  const existing = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .limit(1)

  if (existing.length > 0) {
    console.log("[seed] Já existem lançamentos; pulando demo.")
    return
  }

  const demoTransactions = buildLedger()
  const { invoices: demoInvoices, invoiceItems: demoItems } = buildSeedInvoices()

  const invoiceIdMap = new Map<string, string>()

  for (const invoice of demoInvoices) {
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

  for (const item of demoItems) {
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

  for (const tx of demoTransactions) {
    await db.insert(transactions).values({
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
  }

  const paidOld = demoInvoices.find((invoice) => invoice.status === "paga")
  if (paidOld) {
    const paidId = invoiceIdMap.get(paidOld.id)
    if (paidId) {
      const items = demoItems.filter((item) => item.invoiceId === paidOld.id)
      const total = items.reduce((sum, item) => sum + item.amount, 0)
      const [payment] = await db
        .insert(transactions)
        .values({
          userId,
          date: paidOld.paidAt ?? paidOld.dueDate,
          description: `Pagamento fatura ${paidOld.label} · ${formatCompetenceLabel(paidOld.competence)}`,
          categoryId: "taxas",
          method: "pix",
          amount: total,
          type: "saida",
          tag: "cartao",
          note: "",
          recurring: false,
          invoiceId: paidId,
        })
        .returning()

      await db
        .update(invoices)
        .set({ paymentTransactionId: payment.id })
        .where(eq(invoices.id, paidId))
    }
  }

  console.log("[seed] Dados de demonstração inseridos.")
}

async function main() {
  const admin = await ensureAdmin()
  await ensureDefaultObligations(admin.id)
  await seedDemoIfEmpty(admin.id)
  console.log("[seed] Concluído.")
  const { getSql } = await import("../src/db/client")
  await getSql().end({ timeout: 5 })
  process.exit(0)
}

main().catch((error) => {
  console.error("[seed] Falhou:", error)
  process.exit(1)
})
