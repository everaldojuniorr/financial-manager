"use client"

import * as React from "react"

import { AppShell, type AppSection } from "@/components/finance/app-shell"
import { InvestmentCalculator } from "@/components/finance/investment-calculator"
import { InvoiceDetailSheet } from "@/components/finance/invoice-detail-sheet"
import { InvoicesPanel } from "@/components/finance/invoices-panel"
import { InvestmentsPanel } from "@/components/finance/investments-panel"
import { SettingsPanel } from "@/components/finance/settings-panel"
import { MonthBalance } from "@/components/finance/month-balance"
import { ObligationsPanel } from "@/components/finance/obligations-panel"
import { QuickEntry } from "@/components/finance/quick-entry"
import { SegmentBreakdown } from "@/components/finance/segment-breakdown"
import { SummaryCards } from "@/components/finance/summary-cards"
import { DashboardSkeleton, ErrorState } from "@/components/finance/states"
import {
  buildSegmentUsage,
  buildPeriod,
  buildSummary,
  gridCompetence,
  investmentRowsForPeriod,
  type PeriodId,
} from "@/lib/finance"
import { formatCompetence, formatFullDate, toISODate } from "@/lib/format"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type {
  InvoiceItem,
  InvoiceWithTotal,
  NewTransaction,
  Obligation,
  ObligationEntry,
  ObligationKind,
  PaymentMethod,
  SegmentId,
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
      obligations: Obligation[]
      obligationEntries: ObligationEntry[]
    }

export function Dashboard() {
  const [state, setState] = React.useState<LoadState>({ status: "loading" })
  const [periodId, setPeriodId] = React.useState<PeriodId>("mes-atual")
  const [section, setSection] = React.useState<AppSection>("inicio")
  const [refreshing, setRefreshing] = React.useState(false)
  const [detailInvoice, setDetailInvoice] = React.useState<InvoiceWithTotal | null>(null)
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
        obligations: Obligation[]
        obligationEntries: ObligationEntry[]
      }
      return {
        status: "ready",
        transactions: payload.transactions,
        invoices: payload.invoices,
        invoiceItems: payload.invoiceItems,
        obligations: payload.obligations,
        obligationEntries: payload.obligationEntries,
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
      const next = await fetchLedger()
      setState(next)
      setRefreshing(false)
      return next
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
  }, [])

  const handleDelete = React.useCallback(async (transaction: Transaction) => {
    const snapshot = transaction
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            transactions: current.transactions.filter((item) => item.id !== snapshot.id),
          }
        : current
    )

    const response = await fetch(`/api/transactions/${snapshot.id}`, { method: "DELETE" })
    if (!response.ok && response.status !== 404) {
      setState((current) =>
        current.status === "ready"
          ? {
              ...current,
              transactions: [snapshot, ...current.transactions].sort((a, b) =>
                a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)
              ),
            }
          : current
      )
    }
  }, [])

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

  const refreshInvoiceInState = React.useCallback(
    (invoice: InvoiceWithTotal, items: InvoiceItem[], transaction?: Transaction) => {
      setState((current) => {
        if (current.status !== "ready") return current
        return {
          ...current,
          invoices: current.invoices.map((row) => (row.id === invoice.id ? invoice : row)),
          invoiceItems: [
            ...current.invoiceItems.filter((item) => item.invoiceId !== invoice.id),
            ...items,
          ],
          transactions: transaction
            ? [transaction, ...current.transactions].sort((a, b) =>
                a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)
              )
            : current.transactions,
        }
      })
      setDetailInvoice(invoice)
    },
    []
  )

  const reloadInvoice = React.useCallback(
    async (invoiceId: string, transaction?: Transaction) => {
      const detail = await fetch(`/api/invoices/${invoiceId}`, { cache: "no-store" })
      const detailPayload = (await detail.json()) as {
        invoice: InvoiceWithTotal
        items: InvoiceItem[]
      }
      refreshInvoiceInState(detailPayload.invoice, detailPayload.items, transaction)
      const ledger = await fetchLedger()
      if (ledger.status === "ready") {
        setState(ledger)
        const updated = ledger.invoices.find((item) => item.id === invoiceId)
        if (updated) setDetailInvoice(updated)
      }
    },
    [fetchLedger, refreshInvoiceInState]
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
        body: JSON.stringify(input),
      })
      const payload = (await response.json().catch(() => null)) as { errors?: string[] } | null
      if (!response.ok) {
        throw new Error(payload?.errors?.join(" ") ?? "Não foi possível salvar.")
      }
      await reloadInvoice(detailInvoice.id)
    },
    [detailInvoice, reloadInvoice]
  )

  const handleDeleteItem = React.useCallback(
    async (itemId: string) => {
      if (!detailInvoice) return
      await fetch(`/api/invoices/${detailInvoice.id}/items/${itemId}`, { method: "DELETE" })
      await reloadInvoice(detailInvoice.id)
    },
    [detailInvoice, reloadInvoice]
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
        transaction?: Transaction
        errors?: string[]
      } | null
      if (!response.ok) {
        throw new Error(payload?.errors?.join(" ") ?? "Não foi possível quitar.")
      }
      await reloadInvoice(detailInvoice.id, payload?.transaction)
    },
    [detailInvoice, reloadInvoice]
  )

  const handleSetStatedTotal = React.useCallback(
    async (statedTotal: number | null) => {
      if (!detailInvoice) return
      const response = await fetch(`/api/invoices/${detailInvoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statedTotal }),
      })
      const payload = (await response.json().catch(() => null)) as { errors?: string[] } | null
      if (!response.ok) {
        throw new Error(payload?.errors?.join(" ") ?? "Não foi possível salvar o valor final.")
      }
      await reloadInvoice(detailInvoice.id)
    },
    [detailInvoice, reloadInvoice]
  )

  const replaceObligations = React.useCallback(
    (obligations: Obligation[], obligationEntries?: ObligationEntry[]) => {
      setState((current) =>
        current.status === "ready"
          ? {
              ...current,
              obligations,
              obligationEntries: obligationEntries ?? current.obligationEntries,
            }
          : current
      )
    },
    []
  )

  const handleCreateObligation = React.useCallback(
    async (kind: ObligationKind, input: { name: string; segment: SegmentId }) => {
      const response = await fetch("/api/obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, kind }),
      })
      const payload = (await response.json().catch(() => null)) as {
        obligation?: Obligation
        errors?: string[]
      } | null
      if (!response.ok || !payload?.obligation) {
        throw new Error(payload?.errors?.join(" ") ?? "Não foi possível criar.")
      }
      setState((current) =>
        current.status === "ready"
          ? { ...current, obligations: [...current.obligations, payload.obligation!] }
          : current
      )
    },
    []
  )

  const handleArchiveObligation = React.useCallback(async (id: string) => {
    const response = await fetch(`/api/obligations/${id}`, { method: "DELETE" })
    if (!response.ok) throw new Error("Não foi possível arquivar.")
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            obligations: current.obligations.map((item) =>
              item.id === id ? { ...item, active: false } : item
            ),
          }
        : current
    )
  }, [])

  const handleSaveEntry = React.useCallback(
    async (
      competence: string,
      input: { obligationId: string; amount: number | null; paid: boolean }
    ) => {
      const response = await fetch(`/api/obligations/${input.obligationId}/entries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competence,
          amount: input.amount,
          paid: input.paid,
        }),
      })
      const payload = (await response.json().catch(() => null)) as {
        entry?: ObligationEntry
        errors?: string[]
      } | null
      if (!response.ok || !payload?.entry) {
        throw new Error(payload?.errors?.join(" ") ?? "Não foi possível salvar.")
      }
      const entry = payload.entry
      setState((current) => {
        if (current.status !== "ready") return current
        const rest = current.obligationEntries.filter(
          (item) =>
            !(item.obligationId === entry.obligationId && item.competence === entry.competence)
        )
        return { ...current, obligationEntries: [...rest, entry] }
      })
    },
    []
  )

  const handleCopyPrevious = React.useCallback(
    async (kind: "fixa" | "emprestimo", competence: string) => {
      const response = await fetch("/api/obligations/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, competence }),
      })
      const payload = (await response.json().catch(() => null)) as { errors?: string[] } | null
      if (!response.ok) {
        throw new Error(payload?.errors?.join(" ") ?? "Não foi possível copiar.")
      }
      const ledger = await fetchLedger()
      if (ledger.status === "ready") {
        replaceObligations(ledger.obligations, ledger.obligationEntries)
      }
    },
    [fetchLedger, replaceObligations]
  )

  if (state.status === "loading") {
    return (
      <AppShell
        section={section}
        onSectionChange={setSection}
        periodId={periodId}
        onPeriodChange={setPeriodId}
        disabled
      >
        <DashboardSkeleton />
      </AppShell>
    )
  }

  if (state.status === "error") {
    return (
      <AppShell
        section={section}
        onSectionChange={setSection}
        periodId={periodId}
        onPeriodChange={setPeriodId}
        disabled
      >
        <ErrorState message={state.message} onRetry={() => reload("retry")} />
      </AppShell>
    )
  }

  const period = buildPeriod(periodId, today)
  const competence = gridCompetence(period)
  const rolling = period.id === "ultimos-30" || period.id === "ultimos-90"
  const ledger = {
    transactions: state.transactions,
    invoices: state.invoices,
    invoiceItems: state.invoiceItems,
    obligations: state.obligations,
    obligationEntries: state.obligationEntries,
  }
  const summary = buildSummary(ledger, period)
  const segments = buildSegmentUsage(ledger, period)
  const investmentRows = investmentRowsForPeriod(ledger, period)
  const todayISO = toISODate(today)
  const detailItems = detailInvoice
    ? state.invoiceItems.filter((item) => item.invoiceId === detailInvoice.id)
    : []

  return (
    <AppShell
      section={section}
      onSectionChange={setSection}
      periodId={periodId}
      onPeriodChange={setPeriodId}
      todayLabel={formatFullDate(todayISO)}
      onRefresh={() => reload("refresh")}
      refreshing={refreshing}
    >
      {section === "inicio" && (
        <div className="space-y-4">
          <SummaryCards summary={summary} periodLabel={period.label} />
          <MonthBalance summary={summary} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <SegmentBreakdown usage={segments} />
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Entrada</CardTitle>
                <CardDescription>Salário, freelance ou reembolso.</CardDescription>
              </CardHeader>
              <CardContent>
                <QuickEntry today={todayISO} onCreate={handleCreate} incomeOnly />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {section !== "inicio" && section !== "investimentos" && rolling && (
        <p className="text-sm text-muted-foreground">
          A grade está em {formatCompetence(competence)}. O início soma o período selecionado.
        </p>
      )}

      {section === "cartoes" && (
        <InvoicesPanel
          invoices={state.invoices}
          competence={competence}
          onOpenDetails={(invoice) => {
            setDetailInvoice(invoice)
            setDetailOpen(true)
          }}
          onCreate={handleCreateInvoice}
        />
      )}

      {section === "emprestimos" && (
        <ObligationsPanel
          kind="emprestimo"
          competence={competence}
          obligations={state.obligations}
          entries={state.obligationEntries}
          onCreate={(input) => handleCreateObligation("emprestimo", input)}
          onArchive={handleArchiveObligation}
          onSaveEntry={(input) => handleSaveEntry(competence, input)}
          onCopyPrevious={() => handleCopyPrevious("emprestimo", competence)}
        />
      )}

      {section === "dividas-fixas" && (
        <ObligationsPanel
          kind="fixa"
          competence={competence}
          obligations={state.obligations}
          entries={state.obligationEntries}
          onCreate={(input) => handleCreateObligation("fixa", input)}
          onArchive={handleArchiveObligation}
          onSaveEntry={(input) => handleSaveEntry(competence, input)}
          onCopyPrevious={() => handleCopyPrevious("fixa", competence)}
        />
      )}

      {section === "dividas-variaveis" && (
        <ObligationsPanel
          kind="variavel"
          competence={competence}
          obligations={state.obligations}
          entries={state.obligationEntries}
          onCreate={(input) => handleCreateObligation("variavel", input)}
          onArchive={handleArchiveObligation}
          onSaveEntry={(input) => handleSaveEntry(competence, input)}
        />
      )}

      {section === "configuracoes" && (
        <SettingsPanel onChanged={() => reload("refresh")} />
      )}

      {section === "investimentos" && (
        <div className="space-y-4">
          <InvestmentsPanel
            transactions={investmentRows}
            today={todayISO}
            onCreate={handleCreate}
            onDelete={handleDelete}
          />
          <InvestmentCalculator />
        </div>
      )}

      <InvoiceDetailSheet
        invoice={detailInvoice}
        items={detailItems}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        today={todayISO}
        onAddItem={handleAddItem}
        onDeleteItem={handleDeleteItem}
        onPay={handlePayInvoice}
        onSetStatedTotal={handleSetStatedTotal}
      />
    </AppShell>
  )
}
