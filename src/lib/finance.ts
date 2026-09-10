import { EXPENSE_CATEGORIES, getCategory } from "./categories"
import { parseDate, toISODate } from "./format"
import type { Category, Invoice, InvoiceItem, Transaction, TransactionType } from "./types"

export type PeriodId = "mes-atual" | "mes-anterior" | "ultimos-30" | "ultimos-90"

export type Period = {
  id: PeriodId
  label: string
  start: string
  end: string
  previousStart: string
  previousEnd: string
  budgetFactor: number
  daysTotal: number
  daysElapsed: number
}

export const PERIOD_OPTIONS: { id: PeriodId; label: string }[] = [
  { id: "mes-atual", label: "Mês atual" },
  { id: "mes-anterior", label: "Mês anterior" },
  { id: "ultimos-30", label: "Últimos 30 dias" },
  { id: "ultimos-90", label: "Últimos 90 dias" },
]

export type LedgerView = {
  transactions: Transaction[]
  invoices: Invoice[]
  invoiceItems: InvoiceItem[]
}

function daysBetween(startISO: string, endISO: string) {
  return (
    Math.round(
      (parseDate(endISO).getTime() - parseDate(startISO).getTime()) / 86_400_000
    ) + 1
  )
}

function shiftDays(iso: string, days: number) {
  const date = parseDate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function buildPeriod(id: PeriodId, today: Date): Period {
  const todayISO = toISODate(today)
  const label = PERIOD_OPTIONS.find((p) => p.id === id)?.label ?? "Período"

  let start: string
  let end: string
  let daysTotal: number
  let daysElapsed: number

  if (id === "mes-atual") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1)
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    start = toISODate(first)
    end = toISODate(last)
    daysTotal = last.getDate()
    daysElapsed = today.getDate()
  } else if (id === "mes-anterior") {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const last = new Date(today.getFullYear(), today.getMonth(), 0)
    start = toISODate(first)
    end = toISODate(last)
    daysTotal = last.getDate()
    daysElapsed = daysTotal
  } else {
    const span = id === "ultimos-30" ? 30 : 90
    start = shiftDays(todayISO, -(span - 1))
    end = todayISO
    daysTotal = span
    daysElapsed = span
  }

  const length = daysBetween(start, end)

  return {
    id,
    label,
    start,
    end,
    previousEnd: shiftDays(start, -1),
    previousStart: shiftDays(start, -length),
    budgetFactor: daysTotal / 30,
    daysTotal,
    daysElapsed,
  }
}

export function inRange(date: string, start: string, end: string) {
  return date >= start && date <= end
}

/** Legacy seed rows — credit purchases now live inside invoices. */
export function isLegacyCredit(transaction: Transaction) {
  return transaction.method === "credito" && !transaction.invoiceId
}

/** Rows that move cash: everything except legacy credit noise. */
export function isCashLedgerRow(transaction: Transaction) {
  return !isLegacyCredit(transaction)
}

/** Cash rows that should appear in category/tag panels (not invoice payments). */
export function isCategoryCashExpense(transaction: Transaction) {
  return (
    transaction.type === "saida" &&
    isCashLedgerRow(transaction) &&
    !transaction.invoiceId
  )
}

export function competenceInPeriod(competence: string, period: Period) {
  const [year, month] = competence.split("-").map(Number)
  const start = `${competence}-01`
  const end = toISODate(new Date(year, month, 0))
  return end >= period.start && start <= period.end
}

export function invoiceItemsInPeriod(
  items: InvoiceItem[],
  invoices: Invoice[],
  period: Period
) {
  const map = new Map(invoices.map((invoice) => [invoice.id, invoice]))
  return items.filter((item) => {
    const invoice = map.get(item.invoiceId)
    return invoice && competenceInPeriod(invoice.competence, period)
  })
}

function sumBy(transactions: Transaction[], type: TransactionType) {
  return transactions.reduce((sum, t) => (t.type === type ? sum + t.amount : sum), 0)
}

export type Summary = {
  income: number
  expense: number
  balance: number
  savingsRate: number
  transactionCount: number
  averageTicket: number
  largestExpense: Transaction | null
  previous: {
    income: number
    expense: number
    balance: number
  }
}

export function buildSummary(ledger: LedgerView, period: Period): Summary {
  const cash = ledger.transactions.filter(isCashLedgerRow)
  const current = cash.filter((t) => inRange(t.date, period.start, period.end))
  const previous = cash.filter((t) =>
    inRange(t.date, period.previousStart, period.previousEnd)
  )

  const income = sumBy(current, "entrada")
  const expense = sumBy(current, "saida")
  const expenses = current.filter((t) => t.type === "saida")

  const largestExpense = expenses.reduce<Transaction | null>(
    (max, t) => (!max || t.amount > max.amount ? t : max),
    null
  )

  const previousIncome = sumBy(previous, "entrada")
  const previousExpense = sumBy(previous, "saida")

  return {
    income,
    expense,
    balance: income - expense,
    savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0,
    transactionCount: current.length,
    averageTicket: expenses.length > 0 ? expense / expenses.length : 0,
    largestExpense,
    previous: {
      income: previousIncome,
      expense: previousExpense,
      balance: previousIncome - previousExpense,
    },
  }
}

export function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return ((current - previous) / Math.abs(previous)) * 100
}

export type DailyPoint = {
  date: string
  income: number
  expense: number
  net: number
  count: number
}

export function buildDailySeries(ledger: LedgerView, period: Period): DailyPoint[] {
  const buckets = new Map<string, DailyPoint>()

  for (let iso = period.start; iso <= period.end; iso = shiftDays(iso, 1)) {
    buckets.set(iso, { date: iso, income: 0, expense: 0, net: 0, count: 0 })
  }

  for (const transaction of ledger.transactions.filter(isCashLedgerRow)) {
    const bucket = buckets.get(transaction.date)
    if (!bucket) continue
    if (transaction.type === "entrada") bucket.income += transaction.amount
    else bucket.expense += transaction.amount
    bucket.net = bucket.income - bucket.expense
    bucket.count += 1
  }

  return [...buckets.values()]
}

export type CategoryUsage = {
  category: Category
  spent: number
  budget: number
  usage: number
  count: number
  share: number
  overBudget: boolean
}

export function buildCategoryUsage(
  ledger: LedgerView,
  period: Period
): CategoryUsage[] {
  const cash = ledger.transactions.filter(
    (t) => isCategoryCashExpense(t) && inRange(t.date, period.start, period.end)
  )
  const invoiceRows = invoiceItemsInPeriod(
    ledger.invoiceItems,
    ledger.invoices,
    period
  )

  const total =
    cash.reduce((sum, t) => sum + t.amount, 0) +
    invoiceRows.reduce((sum, item) => sum + item.amount, 0)

  const totals = new Map<string, { spent: number; count: number }>()

  for (const transaction of cash) {
    const entry = totals.get(transaction.categoryId) ?? { spent: 0, count: 0 }
    entry.spent += transaction.amount
    entry.count += 1
    totals.set(transaction.categoryId, entry)
  }

  for (const item of invoiceRows) {
    const entry = totals.get(item.categoryId) ?? { spent: 0, count: 0 }
    entry.spent += item.amount
    entry.count += 1
    totals.set(item.categoryId, entry)
  }

  return EXPENSE_CATEGORIES.map((category) => {
    const entry = totals.get(category.id) ?? { spent: 0, count: 0 }
    const budget = category.monthlyBudget * period.budgetFactor
    return {
      category,
      spent: entry.spent,
      budget,
      usage: budget > 0 ? (entry.spent / budget) * 100 : 0,
      count: entry.count,
      share: total > 0 ? (entry.spent / total) * 100 : 0,
      overBudget: budget > 0 && entry.spent > budget,
    }
  }).sort((a, b) => b.spent - a.spent)
}

export type Pacing = {
  budget: number
  spent: number
  expectedByNow: number
  remaining: number
  dailyAllowance: number
  daysLeft: number
  daysTotal: number
  averageDailyBurn: number
  projected: number
  onTrack: boolean
}

function sumAmounts(transactions: Transaction[]) {
  return transactions.reduce((sum, t) => sum + t.amount, 0)
}

export function buildPacing(ledger: LedgerView, period: Period): Pacing {
  const expenses = ledger.transactions.filter(
    (t) => t.type === "saida" && isCashLedgerRow(t)
  )
  const current = expenses.filter((t) => inRange(t.date, period.start, period.end))
  const previous = expenses.filter((t) =>
    inRange(t.date, period.previousStart, period.previousEnd)
  )

  const spent = sumAmounts(current)
  const recurringSoFar = sumAmounts(current.filter((t) => t.recurring))
  const variableSoFar = spent - recurringSoFar
  const expectedRecurring = Math.max(
    recurringSoFar,
    sumAmounts(previous.filter((t) => t.recurring))
  )

  const budget = EXPENSE_CATEGORIES.reduce(
    (sum, c) => sum + c.monthlyBudget * period.budgetFactor,
    0
  )

  const daysLeft = Math.max(period.daysTotal - period.daysElapsed, 0)
  const discretionaryBudget = Math.max(budget - expectedRecurring, 0)
  const variableDailyBurn =
    period.daysElapsed > 0 ? variableSoFar / period.daysElapsed : 0
  const projected =
    daysLeft === 0 ? spent : expectedRecurring + variableDailyBurn * period.daysTotal

  return {
    budget,
    spent,
    expectedByNow:
      recurringSoFar + (discretionaryBudget / period.daysTotal) * period.daysElapsed,
    remaining: budget - spent,
    dailyAllowance:
      daysLeft > 0
        ? Math.max(discretionaryBudget - variableSoFar, 0) / daysLeft
        : budget - spent,
    daysLeft,
    daysTotal: period.daysTotal,
    averageDailyBurn: period.daysElapsed > 0 ? spent / period.daysElapsed : 0,
    projected,
    onTrack: projected <= budget,
  }
}

export function topTags(ledger: LedgerView, period: Period, limit = 6) {
  const cash = ledger.transactions.filter(
    (t) =>
      isCategoryCashExpense(t) && inRange(t.date, period.start, period.end) && t.tag
  )
  const invoiceRows = invoiceItemsInPeriod(
    ledger.invoiceItems,
    ledger.invoices,
    period
  ).filter((item) => item.tag)

  const totals = new Map<string, { spent: number; count: number }>()

  for (const transaction of cash) {
    const entry = totals.get(transaction.tag) ?? { spent: 0, count: 0 }
    entry.spent += transaction.amount
    entry.count += 1
    totals.set(transaction.tag, entry)
  }

  for (const item of invoiceRows) {
    const entry = totals.get(item.tag) ?? { spent: 0, count: 0 }
    entry.spent += item.amount
    entry.count += 1
    totals.set(item.tag, entry)
  }

  return [...totals.entries()]
    .map(([tag, entry]) => ({ tag, ...entry }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, limit)
}

export function ledgerRowsForTable(ledger: LedgerView, period: Period) {
  return ledger.transactions.filter(
    (t) => isCashLedgerRow(t) && inRange(t.date, period.start, period.end)
  )
}

export function describeTransaction(transaction: Transaction) {
  return `${transaction.description} · ${getCategory(transaction.categoryId).name}`
}
