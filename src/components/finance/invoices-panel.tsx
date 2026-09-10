"use client"

import * as React from "react"
import { CreditCard, Eye, EyeOff, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/finance/states"
import { formatCompetence, formatCurrency, formatDayMonth } from "@/lib/format"
import { INVOICE_STATUS_LABEL, type InvoiceWithTotal } from "@/lib/types"
import { cn } from "@/lib/utils"

function officialTotal(invoice: InvoiceWithTotal) {
  return invoice.statedTotal ?? invoice.total
}

export function InvoicesPanel({
  invoices,
  competence: selectedCompetence,
  onOpenDetails,
  onCreate,
}: {
  invoices: InvoiceWithTotal[]
  competence: string
  onOpenDetails: (invoice: InvoiceWithTotal) => void
  onCreate: (input: {
    label: string
    competence: string
    dueDate: string
  }) => Promise<void>
}) {
  const [showPaid, setShowPaid] = React.useState(false)
  const [label, setLabel] = React.useState("Nubank")
  const [competence, setCompetence] = React.useState(selectedCompetence)
  const [dueDate, setDueDate] = React.useState("")
  const [errors, setErrors] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setCompetence(selectedCompetence)
  }, [selectedCompetence])

  const inMonth = invoices.filter((invoice) => invoice.competence === selectedCompetence)
  const open = inMonth.filter((invoice) => invoice.status !== "paga")
  const paid = inMonth.filter((invoice) => invoice.status === "paga")
  const visible = showPaid ? [...open, ...paid] : open

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setErrors([])
    try {
      await onCreate({ label, competence, dueDate })
      setDueDate("")
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : "Não foi possível criar a fatura.",
      ])
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-4 text-muted-foreground" />
          Faturas de cartão
        </CardTitle>
        <CardDescription>
          {formatCompetence(selectedCompetence)}. Compras e parcelas ficam nos detalhes.
        </CardDescription>
        <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setShowPaid((current) => !current)}
          >
            {showPaid ? <EyeOff /> : <Eye />}
            {showPaid ? "Ocultar pagas" : "Ver pagas"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <form onSubmit={handleCreate} className="grid gap-2 rounded-lg border border-dashed p-3">
          <p className="text-xs font-medium text-muted-foreground">Nova fatura</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="invoice-label" className="text-xs">
                Cartão
              </Label>
              <Input
                id="invoice-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Nubank"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invoice-competence" className="text-xs">
                Competência
              </Label>
              <Input
                id="invoice-competence"
                type="month"
                value={competence}
                onChange={(event) => setCompetence(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invoice-due" className="text-xs">
                Vencimento
              </Label>
              <Input
                id="invoice-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                required
              />
            </div>
          </div>
          {errors.length > 0 && (
            <ul className="text-xs text-destructive">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          <Button type="submit" size="sm" variant="outline" disabled={saving}>
            <Plus />
            Criar fatura
          </Button>
        </form>

        {visible.length === 0 ? (
          <EmptyState
            title={
              showPaid
                ? "Nenhuma fatura neste mês"
                : "Nenhuma fatura em aberto neste mês"
            }
            description={
              showPaid
                ? "Crie a fatura do mês e lance as compras nos detalhes."
                : "Todas as faturas visíveis estão pagas. Ative “Ver pagas” para o histórico."
            }
          />
        ) : (
          <ul className="divide-y rounded-lg border">
            {visible.map((invoice) => (
              <li key={invoice.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{invoice.label}</span>
                    <Badge
                      variant={
                        invoice.status === "paga"
                          ? "secondary"
                          : invoice.status === "fechada"
                            ? "outline"
                            : "default"
                      }
                      className={cn(
                        invoice.status === "paga" && "bg-positive-muted text-positive"
                      )}
                    >
                      {INVOICE_STATUS_LABEL[invoice.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCompetence(invoice.competence)} · vence{" "}
                    {formatDayMonth(invoice.dueDate)} · {invoice.itemCount} compra
                    {invoice.itemCount === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="shrink-0 font-medium tabular">
                  {formatCurrency(officialTotal(invoice))}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenDetails(invoice)}
                >
                  Detalhes
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
