"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LogOut, Plus, RefreshCw, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BudgetPacing } from "@/components/finance/budget-pacing"
import { CashFlowChart } from "@/components/finance/cash-flow-chart"
import { CategoryBreakdown } from "@/components/finance/category-breakdown"
import { InvoiceDetailSheet } from "@/components/finance/invoice-detail-sheet"
import { InvoicesPanel } from "@/components/finance/invoices-panel"
import { LeakPanel } from "@/components/finance/leak-panel"
import { QuickEntry } from "@/components/finance/quick-entry"
import { SummaryCards } from "@/components/finance/summary-cards"
import { DashboardSkeleton, ErrorState } from "@/components/finance/states"
import { ThemeToggle } from "@/components/finance/theme-toggle"
import {
  TransactionsTable,
  type SortDirection,
  type SortKey,
  type TableFilters,
} from "@/components/finance/transactions-table"
import {
  buildCategoryUsage,
  buildDailySeries,
  buildPacing,
  buildPeriod,
  buildSummary,
  ledgerRowsForTable,
  PERIOD_OPTIONS,
  topTags,
  type LedgerView,
  type PeriodId,
} from "@/lib/finance"
import { formatFullDate, toISODate } from "@/lib/format"
import type {
  InvoiceItem,
  InvoiceWithTotal,
  NewTransaction,
  PaymentMethod,
  Transaction,
} from "@/lib/types"

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready"
      transactions: Transaction[]
      invoices: InvoiceWithTotal[]
      invoiceItems: InvoiceItem[]
    }

const INITIAL_FILTERS: TableFilters = {
  search: "",
  type: "todos",
  category: "todas",
  method: "todos",
}

export function Dashboard() {
  const [state, setState] = React.useState<LoadState>({ status: "loading" })
  const [periodId, setPeriodId] = React.useState<PeriodId>("mes-atual")
  const [filters, setFilters] = React.useState<TableFilters>(INITIAL_FILTERS)
  const [sortKey, setSortKey] = React.useState<SortKey>("date")
  const [direction, setDirection] = React.useState<SortDirection>("desc")
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)
  const [detailInvoice, setDetailInvoice] = React.useState<InvoiceWithTotal | null>(
    null
  )
  const [detailOpen, setDetailOpen] = React.useState(false)

  const [today] = React.useState(() => new Date())

  const fetchLedger = React.useCallback(async (): Promise<LoadState> => {
    try {
      const response = await fetch("/api/transactions", { cache: "no-store" })
      if (!response.ok) {
        throw new Error(`O servidor respondeu com status ${response.status}.`)
      }
      const payload = (await response.json()) as {
        transactions: Transaction[]
        invoices: InvoiceWithTotal[]
        invoiceItems: InvoiceItem[]
      }
      return {
        status: "ready",
        transactions: payload.transactions,
        invoices: payload.invoices,
        invoiceItems: payload.invoiceItems,
      }
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Verifique sua conexão e tente novamente.",
      }
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    fetchLedger().then((result) => {
      if (!cancelled) setState(result)
    })
    return () => {
      cancelled = true
    }
  }, [fetchLedger])

  const reload = React.useCallback(
    async (mode: "retry" | "refresh") => {
      if (mode === "retry") setState({ status: "loading" })
      else setRefreshing(true)
      setState(await fetchLedger())
      setRefreshing(false)
    },
    [fetchLedger]
  )

  const handleCreate = React.useCallback(async (input: NewTransaction) => {
    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        errors?: string[]
      } | null
      throw new Error(payload?.errors?.join(" ") ?? "Não foi possível salvar.")
    }

    const { transaction } = (await response.json()) as { transaction: Transaction }
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            transactions: [transaction, ...current.transactions].sort((a, b) =>
              a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)
            ),
          }
        : current
    )
    setSheetOpen(false)
  }, [])

  const handleDelete = React.useCallback(async (transaction: Transaction) => {
    const snapshot = transaction
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            transactions: current.transactions.filter((t) => t.id !== snapshot.id),
          }
        : current
    )

    const response = await fetch(`/api/transactions/${snapshot.id}`, {
      method: "DELETE",
    })

    if (!response.ok && response.status !== 404) {
      setState((current) =>
        current.status === "ready"
          ? {
              ...current,
              transactions: [snapshot, ...current.transactions].sort((a, b) =>
                a.date === b.date
                  ? b.id.localeCompare(a.id)
                  : b.date.localeCompare(a.date)
              ),
            }
          : current
      )
    }
  }, [])

  const handleDuplicate = React.useCallback(
    async (transaction: Transaction) => {
      if (transaction.invoiceId) return
      await handleCreate({
        date: toISODate(today),
        description: transaction.description,
        categoryId: transaction.categoryId,
        method: transaction.method,
        amount: transaction.amount,
        type: transaction.type,
        tag: transaction.tag,
        note: transaction.note,
        recurring: false,
      })
    },
    [handleCreate, today]
  )

  const handleCreateInvoice = React.useCallback(
    async (input: { label: string; competence: string; dueDate: string }) => {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      const payload = (await response.json().catch(() => null)) as {
        invoice?: InvoiceWithTotal
        errors?: string[]
      } | null
      if (!response.ok) {
        throw new Error(payload?.errors?.join(" ") ?? "Não foi possível criar a fatura.")
      }
      if (!payload?.invoice) return
      setState((current) =>
        current.status === "ready"
          ? { ...current, invoices: [payload.invoice!, ...current.invoices] }
          : current
      )
    },
    []
  )

  const handleOpenDetails = React.useCallback((invoice: InvoiceWithTotal) => {
    setDetailInvoice(invoice)
    setDetailOpen(true)
  }, [])

  const refreshInvoiceInState = React.useCallback(
    (invoice: InvoiceWithTotal, items: InvoiceItem[], transaction?: Transaction) => {
      setState((current) => {
        if (current.status !== "ready") return current
        return {
          ...current,
          invoices: current.invoices.map((row) =>
            row.id === invoice.id ? invoice : row
          ),
          invoiceItems: [
            ...current.invoiceItems.filter((item) => item.invoiceId !== invoice.id),
            ...items,
          ],
          transactions: transaction
            ? [transaction, ...current.transactions].sort((a, b) =>
                a.date === b.date
                  ? b.id.localeCompare(a.id)
                  : b.date.localeCompare(a.date)
              )
            : current.transactions,
        }
      })
      setDetailInvoice(invoice)
    },
    []
  )

  const handleAddItem = React.useCallback(
    async (input: {
      description: string
      amount: number
      categoryId: string
      installmentCurrent: number
      installmentTotal: number
      tag: string
    }) => {
      if (!detailInvoice) return
      const response = await fetch(`/api/invoices/${detailInvoice.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: input.description,
          amount: input.amount,
          categoryId: input.categoryId,
          installmentCurrent: input.installmentCurrent,
          installmentTotal: input.installmentTotal,
          tag: input.tag,
        }),
      })
      const payload = (await response.json().catch(() => null)) as {
        item?: InvoiceItem
        errors?: string[]
      } | null
      if (!response.ok || !payload?.item) {
        throw new Error(payload?.errors?.join(" ") ?? "Não foi possível salvar.")
      }

      const detail = await fetch(`/api/invoices/${detailInvoice.id}`, {
        cache: "no-store",
      })
      const detailPayload = (await detail.json()) as {
        invoice: InvoiceWithTotal
        items: InvoiceItem[]
      }
      refreshInvoiceInState(detailPayload.invoice, detailPayload.items)
    },
    [detailInvoice, refreshInvoiceInState]
  )

  const handleDeleteItem = React.useCallback(
    async (itemId: string) => {
      if (!detailInvoice) return
      await fetch(`/api/invoices/${detailInvoice.id}/items/${itemId}`, {
        method: "DELETE",
      })
      const detail = await fetch(`/api/invoices/${detailInvoice.id}`, {
        cache: "no-store",
      })
      const detailPayload = (await detail.json()) as {
        invoice: InvoiceWithTotal
        items: InvoiceItem[]
      }
      refreshInvoiceInState(detailPayload.invoice, detailPayload.items)
    },
    [detailInvoice, refreshInvoiceInState]
  )

  const handlePayInvoice = React.useCallback(
    async (input: { paidAt: string; method: PaymentMethod }) => {
      if (!detailInvoice) return
      const response = await fetch(`/api/invoices/${detailInvoice.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      const payload = (await response.json().catch(() => null)) as {
        invoice?: InvoiceWithTotal
        transaction?: Transaction
        errors?: string[]
      } | null
      if (!response.ok || !payload?.invoice) {
        throw new Error(payload?.errors?.join(" ") ?? "Não foi possível quitar.")
      }
      const detail = await fetch(`/api/invoices/${detailInvoice.id}`, {
        cache: "no-store",
      })
      const detailPayload = (await detail.json()) as {
        invoice: InvoiceWithTotal
        items: InvoiceItem[]
      }
      refreshInvoiceInState(
        detailPayload.invoice,
        detailPayload.items,
        payload.transaction
      )
    },
    [detailInvoice, refreshInvoiceInState]
  )

  if (state.status === "loading") {
    return (
      <Shell periodId={periodId} onPeriodChange={setPeriodId} disabled>
        <DashboardSkeleton />
      </Shell>
    )
  }

  if (state.status === "error") {
    return (
      <Shell periodId={periodId} onPeriodChange={setPeriodId} disabled>
        <ErrorState message={state.message} onRetry={() => reload("retry")} />
      </Shell>
    )
  }

  const period = buildPeriod(periodId, today)
  const ledger: LedgerView = {
    transactions: state.transactions,
    invoices: state.invoices,
    invoiceItems: state.invoiceItems,
  }

  const summary = buildSummary(ledger, period)
  const series = buildDailySeries(ledger, period)
  const usage = buildCategoryUsage(ledger, period)
  const pacing = buildPacing(ledger, period)
  const leaks = topTags(ledger, period)
  const tableRows = ledgerRowsForTable(ledger, period)
  const todayISO = toISODate(today)
  const detailItems = detailInvoice
    ? state.invoiceItems.filter((item) => item.invoiceId === detailInvoice.id)
    : []

  return (
    <Shell
      periodId={periodId}
      onPeriodChange={setPeriodId}
      todayLabel={formatFullDate(todayISO)}
      onRefresh={() => reload("refresh")}
      refreshing={refreshing}
      quickEntry={
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button className="xl:hidden">
              <Plus />
              Novo lançamento
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Novo lançamento</SheetTitle>
              <SheetDescription>
                Registre entradas e saídas à vista. Cartão vai na fatura.
              </SheetDescription>
            </SheetHeader>
            <QuickEntry today={todayISO} onCreate={handleCreate} layout="sheet" />
          </SheetContent>
        </Sheet>
      }
    >
      <div className="space-y-4">
        <SummaryCards summary={summary} periodLabel={period.label} />

        <InvoicesPanel
          invoices={state.invoices}
          onOpenDetails={handleOpenDetails}
          onCreate={handleCreateInvoice}
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="order-2 space-y-4 xl:order-1">
            <CashFlowChart points={series} periodLabel={period.label} />
            <TransactionsTable
              transactions={tableRows}
              filters={filters}
              onFiltersChange={setFilters}
              sortKey={sortKey}
              direction={direction}
              onSortChange={(key, nextDirection) => {
                setSortKey(key)
                setDirection(nextDirection)
              }}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              today={todayISO}
            />
          </div>

          <div className="order-1 space-y-4 xl:order-2">
            <Card className="hidden xl:block">
              <CardHeader className="border-b">
                <CardTitle>Registro rápido</CardTitle>
                <CardDescription>
                  Entradas e saídas à vista. Compras no cartão ficam na fatura.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <QuickEntry today={todayISO} onCreate={handleCreate} />
              </CardContent>
            </Card>

            <BudgetPacing pacing={pacing} />
            <CategoryBreakdown
              usage={usage}
              selectedCategory={filters.category}
              onSelectCategory={(category) =>
                setFilters((current) => ({ ...current, category }))
              }
            />
            <LeakPanel items={leaks} />
          </div>
        </div>
      </div>

      <InvoiceDetailSheet
        invoice={detailInvoice}
        items={detailItems}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        today={todayISO}
        onAddItem={handleAddItem}
        onDeleteItem={handleDeleteItem}
        onPay={handlePayInvoice}
      />
    </Shell>
  )
}

function Shell({
  children,
  periodId,
  onPeriodChange,
  todayLabel,
  onRefresh,
  refreshing,
  quickEntry,
  disabled = false,
}: {
  children: React.ReactNode
  periodId: PeriodId
  onPeriodChange: (id: PeriodId) => void
  todayLabel?: string
  onRefresh?: () => void
  refreshing?: boolean
  quickEntry?: React.ReactNode
  disabled?: boolean
}) {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = React.useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      router.replace("/login")
      router.refresh()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wallet className="size-4" />
            </span>
            <div className="leading-tight">
              <p className="font-heading text-sm font-semibold">Controle Financeiro</p>
              <p className="text-xs text-muted-foreground">
                {todayLabel ? `Atualizado em ${todayLabel}` : "Carregando dados…"}
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Select
              value={periodId}
              onValueChange={(value) => onPeriodChange(value as PeriodId)}
              disabled={disabled}
            >
              <SelectTrigger className="w-40" aria-label="Selecionar período">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {onRefresh && (
              <Button
                variant="outline"
                size="icon"
                onClick={onRefresh}
                disabled={refreshing}
                aria-label="Recarregar lançamentos"
              >
                <RefreshCw className={refreshing ? "animate-spin" : undefined} />
              </Button>
            )}

            <ThemeToggle />
            <Button
              variant="outline"
              size="icon"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Sair"
            >
              <LogOut />
            </Button>
            {quickEntry}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6 sm:py-6">{children}</main>
    </div>
  )
}
