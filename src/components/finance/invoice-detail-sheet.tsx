"use client"

import * as React from "react"
import { Check, Loader2, Plus, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
} from "@/components/ui/sheet"
import { EmptyState } from "@/components/finance/states"
import { parseAmount } from "@/components/finance/quick-entry"
import { EXPENSE_CATEGORIES, getCategory } from "@/lib/categories"
import {
  formatCompetence,
  formatCurrency,
  formatDayMonth,
  formatInstallment,
} from "@/lib/format"
import {
  CASH_PAYMENT_METHODS,
  INVOICE_STATUS_LABEL,
  type InvoiceItem,
  type InvoiceWithTotal,
  type PaymentMethod,
} from "@/lib/types"

type ItemDraft = {
  description: string
  amount: string
  categoryId: string
  installmentCurrent: string
  installmentTotal: string
  tag: string
}

const EMPTY_DRAFT: ItemDraft = {
  description: "",
  amount: "",
  categoryId: "alimentacao",
  installmentCurrent: "1",
  installmentTotal: "1",
  tag: "",
}

export function InvoiceDetailSheet({
  invoice,
  items,
  open,
  onOpenChange,
  today,
  onAddItem,
  onDeleteItem,
  onPay,
}: {
  invoice: InvoiceWithTotal | null
  items: InvoiceItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
  today: string
  onAddItem: (input: {
    description: string
    amount: number
    categoryId: string
    installmentCurrent: number
    installmentTotal: number
    tag: string
  }) => Promise<void>
  onDeleteItem: (itemId: string) => Promise<void>
  onPay: (input: { paidAt: string; method: PaymentMethod }) => Promise<void>
}) {
  if (!invoice) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            Fatura {invoice.label} · {formatCompetence(invoice.competence)}
          </SheetTitle>
          <SheetDescription>
            Vence em {formatDayMonth(invoice.dueDate)} ·{" "}
            <Badge variant="outline">{INVOICE_STATUS_LABEL[invoice.status]}</Badge>
          </SheetDescription>
        </SheetHeader>

        {open && (
          <InvoiceDetailBody
            key={invoice.id}
            invoice={invoice}
            items={items}
            today={today}
            onAddItem={onAddItem}
            onDeleteItem={onDeleteItem}
            onPay={onPay}
            onPaid={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function InvoiceDetailBody({
  invoice,
  items,
  today,
  onAddItem,
  onDeleteItem,
  onPay,
  onPaid,
}: {
  invoice: InvoiceWithTotal
  items: InvoiceItem[]
  today: string
  onAddItem: (input: {
    description: string
    amount: number
    categoryId: string
    installmentCurrent: number
    installmentTotal: number
    tag: string
  }) => Promise<void>
  onDeleteItem: (itemId: string) => Promise<void>
  onPay: (input: { paidAt: string; method: PaymentMethod }) => Promise<void>
  onPaid: () => void
}) {
  const [draft, setDraft] = React.useState<ItemDraft>(EMPTY_DRAFT)
  const [payDate, setPayDate] = React.useState(today)
  const [payMethod, setPayMethod] = React.useState<PaymentMethod>("pix")
  const [errors, setErrors] = React.useState<string[]>([])
  const [status, setStatus] = React.useState<"idle" | "saving" | "paying">("idle")

  const readOnly = invoice.status === "paga"
  const total = items.reduce((sum, item) => sum + item.amount, 0)

  async function handleAddItem(event: React.FormEvent) {
    event.preventDefault()
    const amount = parseAmount(draft.amount)
    const installmentCurrent = Number(draft.installmentCurrent)
    const installmentTotal = Number(draft.installmentTotal)
    const nextErrors: string[] = []

    if (draft.description.trim().length < 2) {
      nextErrors.push("Informe uma descrição.")
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      nextErrors.push("Informe um valor válido.")
    }
    if (
      !Number.isInteger(installmentCurrent) ||
      !Number.isInteger(installmentTotal) ||
      installmentCurrent < 1 ||
      installmentTotal < 1 ||
      installmentCurrent > installmentTotal
    ) {
      nextErrors.push("Informe parcelas válidas (ex.: 5 de 12).")
    }

    if (nextErrors.length) {
      setErrors(nextErrors)
      return
    }

    setStatus("saving")
    setErrors([])
    try {
      await onAddItem({
        description: draft.description.trim(),
        amount,
        categoryId: draft.categoryId,
        installmentCurrent,
        installmentTotal,
        tag: draft.tag.trim(),
      })
      setDraft(EMPTY_DRAFT)
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : "Não foi possível salvar a compra.",
      ])
    } finally {
      setStatus("idle")
    }
  }

  async function handlePay() {
    setStatus("paying")
    setErrors([])
    try {
      await onPay({ paidAt: payDate, method: payMethod })
      onPaid()
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : "Não foi possível registrar o pagamento.",
      ])
    } finally {
      setStatus("idle")
    }
  }

  return (
        <div className="space-y-4 px-4 pb-6">
          <div className="rounded-lg bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground">Total da fatura</p>
            <p className="font-heading text-2xl font-semibold tabular">
              {formatCurrency(total)}
            </p>
          </div>

          {items.length === 0 ? (
            <EmptyState
              title="Nenhuma compra nesta fatura"
              description="Lance aqui o que veio no ciclo — mercado, parcelas, delivery."
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {items.map((item) => {
                const category = getCategory(item.categoryId)
                return (
                  <li key={item.id} className="flex items-start gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {category.name} ·{" "}
                        {formatInstallment(
                          item.installment.current,
                          item.installment.total
                        )}
                        {item.tag ? ` · #${item.tag}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 font-medium tabular">
                      {formatCurrency(item.amount)}
                    </span>
                    {!readOnly && (
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Excluir ${item.description}`}
                        onClick={() => onDeleteItem(item.id)}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {!readOnly && (
            <form onSubmit={handleAddItem} className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium">Adicionar compra</p>
              <div className="space-y-1.5">
                <Label htmlFor="item-description">Descrição</Label>
                <Input
                  id="item-description"
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Mercado, TV, iFood…"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="item-amount">Valor nesta fatura</Label>
                  <Input
                    id="item-amount"
                    inputMode="decimal"
                    value={draft.amount}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, amount: event.target.value }))
                    }
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="item-category">Categoria</Label>
                  <Select
                    value={draft.categoryId}
                    onValueChange={(value) =>
                      setDraft((current) => ({ ...current, categoryId: value }))
                    }
                  >
                    <SelectTrigger id="item-category" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="item-current">Parcela</Label>
                  <Input
                    id="item-current"
                    inputMode="numeric"
                    value={draft.installmentCurrent}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        installmentCurrent: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="item-total">De</Label>
                  <Input
                    id="item-total"
                    inputMode="numeric"
                    value={draft.installmentTotal}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        installmentTotal: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-tag">Etiqueta</Label>
                <Input
                  id="item-tag"
                  value={draft.tag}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, tag: event.target.value }))
                  }
                  placeholder="mercado"
                />
              </div>
              <Button type="submit" className="w-full" disabled={status === "saving"}>
                {status === "saving" ? <Loader2 className="animate-spin" /> : <Plus />}
                Adicionar à fatura
              </Button>
            </form>
          )}

          {!readOnly && total > 0 && (
            <div className="space-y-2 rounded-lg border border-dashed p-3">
              <p className="text-sm font-medium">Registrar pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pay-date">Data do pagamento</Label>
                  <Input
                    id="pay-date"
                    type="date"
                    value={payDate}
                    max={today}
                    onChange={(event) => setPayDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-method">Como pagou</Label>
                  <Select
                    value={payMethod}
                    onValueChange={(value) => setPayMethod(value as PaymentMethod)}
                  >
                    <SelectTrigger id="pay-method" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CASH_PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method.id} value={method.id}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handlePay}
                disabled={status === "paying"}
              >
                {status === "paying" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Check />
                )}
                Quitar fatura · {formatCurrency(total)}
              </Button>
            </div>
          )}

          {errors.length > 0 && (
            <ul className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>
  )
}
