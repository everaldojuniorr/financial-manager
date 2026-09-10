import { and, asc, desc, eq, sql } from "drizzle-orm"
import type { AnyColumn } from "drizzle-orm"

import { getDb } from "@/db/client"
import { invoiceItems, invoices, transactions, users } from "@/db/schema"
import { householdUserIds, memberFilter } from "./household"
import { addMonthsToCompetence, addMonthsToDate, roundMoney } from "./format"
import {
  INVOICE_ADJUSTMENT_DESCRIPTION,
  INVOICE_ADJUSTMENT_TAG,
} from "./types"
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

function mapTransaction(row: typeof transactions.$inferSelect): Transaction {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    categoryId: row.categoryId,
    method: row.method as PaymentMethod,
    amount: row.amount,
    type: row.type as Transaction["type"],
    tag: row.tag,
    note: row.note,
    recurring: row.recurring,
    invoiceId: row.invoiceId,
  }
}

function mapInvoice(row: typeof invoices.$inferSelect): Invoice {
  return {
    id: row.id,
    label: row.label,
    competence: row.competence,
    dueDate: row.dueDate,
    status: row.status as Invoice["status"],
    paidAt: row.paidAt,
    paymentTransactionId: row.paymentTransactionId,
    statedTotal: row.statedTotal,
  }
}

function mapInvoiceItem(row: typeof invoiceItems.$inferSelect): InvoiceItem {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    description: row.description,
    categoryId: row.categoryId,
    amount: row.amount,
    installment: {
      current: row.installmentCurrent,
      total: row.installmentTotal,
    },
    tag: row.tag,
  }
}

async function inHousehold(userId: string, column: AnyColumn) {
  return memberFilter(column, await householdUserIds(userId))
}

function formatCompetenceLabel(competence: string) {
  const [year, month] = competence.split("-").map(Number)
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, 1))
  return label.charAt(0).toUpperCase() + label.slice(1).replace(".", "")
}

async function invoiceAggregates(userId: string, invoiceId: string) {
  const db = getDb()
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${invoiceItems.amount}), 0)`.mapWith(Number),
      itemCount: sql<number>`count(*) filter (where ${invoiceItems.tag} <> ${INVOICE_ADJUSTMENT_TAG})::int`.mapWith(
        Number
      ),
    })
    .from(invoiceItems)
    .where(
      and(await inHousehold(userId, invoiceItems.userId), eq(invoiceItems.invoiceId, invoiceId))
    )
  return {
    total: row?.total ?? 0,
    itemCount: row?.itemCount ?? 0,
  }
}

export async function listTransactions(userId: string): Promise<Transaction[]> {
  const db = getDb()
  const rows = await db
    .select({
      transaction: transactions,
      username: users.username,
    })
    .from(transactions)
    .innerJoin(users, eq(users.id, transactions.userId))
    .where(await inHousehold(userId, transactions.userId))
    .orderBy(desc(transactions.date), desc(transactions.id))
  return rows.map((row) => ({
    ...mapTransaction(row.transaction),
    createdBy: row.username,
  }))
}

export async function listInvoices(userId: string): Promise<InvoiceWithTotal[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(invoices)
    .where(await inHousehold(userId, invoices.userId))
    .orderBy(desc(invoices.competence), desc(invoices.dueDate))

  const result: InvoiceWithTotal[] = []
  for (const row of rows) {
    const aggregates = await invoiceAggregates(userId, row.id)
    result.push({ ...mapInvoice(row), ...aggregates })
  }
  return result
}

export async function getInvoice(
  userId: string,
  id: string
): Promise<InvoiceWithTotal | null> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(invoices)
    .where(and(await inHousehold(userId, invoices.userId), eq(invoices.id, id)))
    .limit(1)
  if (!row) return null
  const aggregates = await invoiceAggregates(userId, id)
  return { ...mapInvoice(row), ...aggregates }
}

export async function listInvoiceItems(
  userId: string,
  invoiceId: string
): Promise<InvoiceItem[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(invoiceItems)
    .where(
      and(await inHousehold(userId, invoiceItems.userId), eq(invoiceItems.invoiceId, invoiceId))
    )
    .orderBy(desc(invoiceItems.amount), asc(invoiceItems.id))
  return rows.map(mapInvoiceItem)
}

export async function createTransaction(
  userId: string,
  input: NewTransaction
): Promise<Transaction> {
  const db = getDb()
  const [row] = await db
    .insert(transactions)
    .values({
      userId,
      date: input.date,
      description: input.description,
      categoryId: input.categoryId,
      method: input.method,
      amount: input.amount,
      type: input.type,
      tag: input.tag,
      note: input.note,
      recurring: input.recurring,
      invoiceId: input.invoiceId ?? null,
    })
    .returning()
  return mapTransaction(row)
}

export async function createInvoice(
  userId: string,
  input: NewInvoice
): Promise<InvoiceWithTotal> {
  const db = getDb()
  const label = input.label.trim()
  const existing = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        await inHousehold(userId, invoices.userId),
        sql`lower(${invoices.label}) = lower(${label})`,
        eq(invoices.competence, input.competence)
      )
    )
    .limit(1)

  if (existing.length > 0) {
    throw new Error("Já existe uma fatura com este cartão e competência.")
  }

  const [row] = await db
    .insert(invoices)
    .values({
      userId,
      label,
      competence: input.competence,
      dueDate: input.dueDate,
      status: input.status ?? "aberta",
      paidAt: null,
      paymentTransactionId: null,
      statedTotal: null,
    })
    .returning()

  return { ...mapInvoice(row), total: 0, itemCount: 0 }
}

export async function updateInvoiceStatus(
  userId: string,
  id: string,
  status: Invoice["status"]
): Promise<InvoiceWithTotal | null> {
  const db = getDb()
  const [row] = await db
    .update(invoices)
    .set({ status })
    .where(and(await inHousehold(userId, invoices.userId), eq(invoices.id, id)))
    .returning()
  if (!row) return null
  return getInvoice(userId, id)
}

export async function deleteInvoice(userId: string, id: string): Promise<boolean> {
  const db = getDb()
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(await inHousehold(userId, invoices.userId), eq(invoices.id, id)))
    .limit(1)
  if (!invoice || invoice.status === "paga") return false

  await db
    .delete(invoices)
    .where(and(await inHousehold(userId, invoices.userId), eq(invoices.id, id)))
  return true
}

function isAdjustmentTag(tag: string) {
  return tag === INVOICE_ADJUSTMENT_TAG
}

async function sumNonAdjustmentItems(userId: string, invoiceId: string) {
  const db = getDb()
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${invoiceItems.amount}), 0)`.mapWith(Number),
    })
    .from(invoiceItems)
    .where(
      and(
        await inHousehold(userId, invoiceItems.userId),
        eq(invoiceItems.invoiceId, invoiceId),
        sql`${invoiceItems.tag} <> ${INVOICE_ADJUSTMENT_TAG}`
      )
    )
  return roundMoney(row?.total ?? 0)
}

async function deleteAdjustmentItems(userId: string, invoiceId: string) {
  const db = getDb()
  await db
    .delete(invoiceItems)
    .where(
      and(
        await inHousehold(userId, invoiceItems.userId),
        eq(invoiceItems.invoiceId, invoiceId),
        eq(invoiceItems.tag, INVOICE_ADJUSTMENT_TAG)
      )
    )
}

/** Recreates the adjustment line so itemized purchases plus adjustment equal the official total. */
export async function syncInvoiceAdjustment(userId: string, invoiceId: string) {
  const db = getDb()
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(await inHousehold(userId, invoices.userId), eq(invoices.id, invoiceId)))
    .limit(1)
  if (!invoice) throw new Error("Fatura não encontrada.")
  if (invoice.statedTotal == null) {
    await deleteAdjustmentItems(userId, invoiceId)
    return
  }

  const itemSum = await sumNonAdjustmentItems(userId, invoiceId)
  const diff = roundMoney(invoice.statedTotal - itemSum)
  if (diff < -0.009) {
    throw new Error(
      "A soma dos lançamentos passa do valor final. Aumente o valor final ou remova lançamentos."
    )
  }

  await deleteAdjustmentItems(userId, invoiceId)
  if (diff <= 0.009) return

  await db.insert(invoiceItems).values({
    userId,
    invoiceId,
    description: INVOICE_ADJUSTMENT_DESCRIPTION,
    categoryId: "compras",
    amount: diff,
    installmentCurrent: 1,
    installmentTotal: 1,
    tag: INVOICE_ADJUSTMENT_TAG,
  })
}

async function findInvoiceByLabel(
  userId: string,
  label: string,
  competence: string
) {
  const db = getDb()
  const [row] = await db
    .select()
    .from(invoices)
    .where(
      and(
        await inHousehold(userId, invoices.userId),
        sql`lower(${invoices.label}) = lower(${label})`,
        eq(invoices.competence, competence)
      )
    )
    .limit(1)
  return row ?? null
}

async function ensureFutureInvoice(
  userId: string,
  source: typeof invoices.$inferSelect,
  competence: string,
  monthOffset: number
) {
  const existing = await findInvoiceByLabel(userId, source.label, competence)
  if (existing) return existing.status === "paga" ? null : existing

  const db = getDb()
  const [created] = await db
    .insert(invoices)
    .values({
      userId,
      label: source.label,
      competence,
      dueDate: addMonthsToDate(source.dueDate, monthOffset),
      status: "aberta",
      paidAt: null,
      paymentTransactionId: null,
      statedTotal: null,
    })
    .returning()
  return created
}

async function insertInvoiceItem(
  userId: string,
  invoiceId: string,
  input: NewInvoiceItem
) {
  const db = getDb()
  const [row] = await db
    .insert(invoiceItems)
    .values({
      userId,
      invoiceId,
      description: input.description,
      categoryId: input.categoryId,
      amount: input.amount,
      installmentCurrent: input.installment.current,
      installmentTotal: input.installment.total,
      tag: input.tag,
    })
    .returning()
  return mapInvoiceItem(row)
}

export async function createInvoiceItem(
  userId: string,
  input: NewInvoiceItem
): Promise<InvoiceItem> {
  const db = getDb()
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(await inHousehold(userId, invoices.userId), eq(invoices.id, input.invoiceId)))
    .limit(1)
  if (!invoice) throw new Error("Fatura não encontrada.")
  if (invoice.status === "paga") {
    throw new Error("Não é possível alterar uma fatura já paga.")
  }
  if (isAdjustmentTag(input.tag)) {
    throw new Error("O ajuste de fatura é gerado pelo valor final.")
  }

  if (invoice.statedTotal != null) {
    const itemSum = await sumNonAdjustmentItems(userId, invoice.id)
    if (roundMoney(itemSum + input.amount) - invoice.statedTotal > 0.009) {
      throw new Error(
        "A soma dos lançamentos passa do valor final. Aumente o valor final ou remova lançamentos."
      )
    }
  }

  const created = await insertInvoiceItem(userId, invoice.id, input)
  const remaining = input.installment.total - input.installment.current

  for (let step = 1; step <= remaining; step++) {
    const competence = addMonthsToCompetence(invoice.competence, step)
    const future = await ensureFutureInvoice(userId, invoice, competence, step)
    if (!future) continue
    await insertInvoiceItem(userId, future.id, {
      ...input,
      invoiceId: future.id,
      installment: {
        current: input.installment.current + step,
        total: input.installment.total,
      },
    })
  }

  if (invoice.statedTotal != null) {
    await syncInvoiceAdjustment(userId, invoice.id)
  }

  return created
}

export async function setInvoiceStatedTotal(
  userId: string,
  invoiceId: string,
  statedTotal: number | null
): Promise<InvoiceWithTotal> {
  const db = getDb()
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(await inHousehold(userId, invoices.userId), eq(invoices.id, invoiceId)))
    .limit(1)
  if (!invoice) throw new Error("Fatura não encontrada.")
  if (invoice.status === "paga") {
    throw new Error("Não é possível alterar uma fatura já paga.")
  }

  if (statedTotal == null) {
    await db
      .update(invoices)
      .set({ statedTotal: null })
      .where(and(await inHousehold(userId, invoices.userId), eq(invoices.id, invoiceId)))
    await deleteAdjustmentItems(userId, invoiceId)
  } else {
    const itemSum = await sumNonAdjustmentItems(userId, invoiceId)
    if (roundMoney(statedTotal - itemSum) < -0.009) {
      throw new Error(
        "A soma dos lançamentos passa do valor final. Aumente o valor final ou remova lançamentos."
      )
    }
    await db
      .update(invoices)
      .set({ statedTotal })
      .where(and(await inHousehold(userId, invoices.userId), eq(invoices.id, invoiceId)))
    await syncInvoiceAdjustment(userId, invoiceId)
  }

  const updated = await getInvoice(userId, invoiceId)
  if (!updated) throw new Error("Fatura não encontrada.")
  return updated
}

export async function updateInvoiceItem(
  userId: string,
  id: string,
  patch: Partial<NewInvoiceItem>
): Promise<InvoiceItem | null> {
  const db = getDb()
  const [existing] = await db
    .select()
    .from(invoiceItems)
    .where(and(await inHousehold(userId, invoiceItems.userId), eq(invoiceItems.id, id)))
    .limit(1)
  if (!existing) return null

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(await inHousehold(userId, invoices.userId), eq(invoices.id, existing.invoiceId)))
    .limit(1)
  if (!invoice || invoice.status === "paga") return null

  if (isAdjustmentTag(existing.tag)) return null

  const [row] = await db
    .update(invoiceItems)
    .set({
      description: patch.description ?? existing.description,
      categoryId: patch.categoryId ?? existing.categoryId,
      amount: patch.amount ?? existing.amount,
      installmentCurrent: patch.installment?.current ?? existing.installmentCurrent,
      installmentTotal: patch.installment?.total ?? existing.installmentTotal,
      tag: patch.tag ?? existing.tag,
      invoiceId: patch.invoiceId ?? existing.invoiceId,
    })
    .where(and(await inHousehold(userId, invoiceItems.userId), eq(invoiceItems.id, id)))
    .returning()

  if (row && invoice.statedTotal != null) {
    await syncInvoiceAdjustment(userId, existing.invoiceId)
  }

  return row ? mapInvoiceItem(row) : null
}

export async function deleteInvoiceItem(
  userId: string,
  id: string
): Promise<boolean> {
  const db = getDb()
  const [item] = await db
    .select()
    .from(invoiceItems)
    .where(and(await inHousehold(userId, invoiceItems.userId), eq(invoiceItems.id, id)))
    .limit(1)
  if (!item) return false

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(await inHousehold(userId, invoices.userId), eq(invoices.id, item.invoiceId)))
    .limit(1)
  if (!invoice || invoice.status === "paga") return false
  if (isAdjustmentTag(item.tag)) return false

  await db
    .delete(invoiceItems)
    .where(and(await inHousehold(userId, invoiceItems.userId), eq(invoiceItems.id, id)))

  if (invoice.statedTotal != null) {
    await syncInvoiceAdjustment(userId, item.invoiceId)
  }
  return true
}

export async function payInvoice(
  userId: string,
  id: string,
  input: { paidAt: string; method: PaymentMethod }
): Promise<{ invoice: InvoiceWithTotal; transaction: Transaction } | null> {
  const db = getDb()
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(await inHousehold(userId, invoices.userId), eq(invoices.id, id)))
    .limit(1)
  if (!invoice || invoice.status === "paga") return null

  const aggregates = await invoiceAggregates(userId, id)
  const amount =
    invoice.statedTotal != null ? roundMoney(invoice.statedTotal) : aggregates.total
  if (amount <= 0) {
    throw new Error(
      "Informe o valor final ou adicione compras antes de registrar o pagamento."
    )
  }

  const transaction = await createTransaction(userId, {
    date: input.paidAt,
    description: `Pagamento fatura ${invoice.label} · ${formatCompetenceLabel(invoice.competence)}`,
    categoryId: "taxas",
    method: input.method,
    amount,
    type: "saida",
    tag: "cartao",
    note: "",
    recurring: false,
    invoiceId: invoice.id,
  })

  await db
    .update(invoices)
    .set({
      status: "paga",
      paidAt: input.paidAt,
      paymentTransactionId: transaction.id,
    })
    .where(and(await inHousehold(userId, invoices.userId), eq(invoices.id, id)))

  const updated = await getInvoice(userId, id)
  return updated ? { invoice: updated, transaction } : null
}

export async function updateTransaction(
  userId: string,
  id: string,
  patch: Partial<NewTransaction>
): Promise<Transaction | null> {
  const db = getDb()
  const [existing] = await db
    .select()
    .from(transactions)
    .where(and(await inHousehold(userId, transactions.userId), eq(transactions.id, id)))
    .limit(1)
  if (!existing || existing.invoiceId) return null

  const [row] = await db
    .update(transactions)
    .set({
      date: patch.date ?? existing.date,
      description: patch.description ?? existing.description,
      categoryId: patch.categoryId ?? existing.categoryId,
      method: patch.method ?? existing.method,
      amount: patch.amount ?? existing.amount,
      type: patch.type ?? existing.type,
      tag: patch.tag ?? existing.tag,
      note: patch.note ?? existing.note,
      recurring: patch.recurring ?? existing.recurring,
    })
    .where(and(await inHousehold(userId, transactions.userId), eq(transactions.id, id)))
    .returning()

  return row ? mapTransaction(row) : null
}

export async function deleteTransaction(
  userId: string,
  id: string
): Promise<boolean> {
  const db = getDb()
  const [transaction] = await db
    .select()
    .from(transactions)
    .where(and(await inHousehold(userId, transactions.userId), eq(transactions.id, id)))
    .limit(1)
  if (!transaction || transaction.invoiceId) return false

  await db
    .delete(transactions)
    .where(and(await inHousehold(userId, transactions.userId), eq(transactions.id, id)))
  return true
}

export async function countUserTransactions(userId: string): Promise<number> {
  const db = getDb()
  const [row] = await db
    .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
    .from(transactions)
    .where(await inHousehold(userId, transactions.userId))
  return row?.count ?? 0
}
