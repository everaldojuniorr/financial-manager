"use client"

import * as React from "react"
import { Check, Landmark, Loader2, Plus, Trash2 } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { EmptyState } from "@/components/finance/states"
import { parseAmount } from "@/components/finance/quick-entry"
import {
  CONTRIBUTION_CATEGORY_ID,
  YIELD_CATEGORY_ID,
  getCategory,
} from "@/lib/categories"
import { formatCurrency, formatDayMonth } from "@/lib/format"
import { CASH_PAYMENT_METHODS } from "@/lib/types"
import type { NewTransaction, PaymentMethod, Transaction } from "@/lib/types"
import { cn } from "@/lib/utils"

type InvestKind = "rendimentos" | "aportes"

type FormState = {
  kind: InvestKind
  amount: string
  description: string
  method: PaymentMethod
  date: string
  tag: string
}

function initialForm(today: string): FormState {
  return {
    kind: "rendimentos",
    amount: "",
    description: "",
    method: "transferencia",
    date: today,
    tag: "",
  }
}

function kindMeta(kind: InvestKind) {
  if (kind === "rendimentos") {
    return {
      categoryId: YIELD_CATEGORY_ID,
      type: "entrada" as const,
      placeholder: "Rendimento CDB liquidez diária",
    }
  }
  return {
    categoryId: CONTRIBUTION_CATEGORY_ID,
    type: "saida" as const,
    placeholder: "Aporte mensal Tesouro Selic",
  }
}

export function InvestmentsPanel({
  transactions,
  today,
  onCreate,
  onDelete,
}: {
  transactions: Transaction[]
  today: string
  onCreate: (input: NewTransaction) => Promise<void>
  onDelete: (transaction: Transaction) => Promise<void>
}) {
  const [form, setForm] = React.useState<FormState>(() => initialForm(today))
  const [errors, setErrors] = React.useState<string[]>([])
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle")
  const [filter, setFilter] = React.useState<"todos" | InvestKind>("todos")

  const visible = transactions.filter((transaction) => {
    if (filter === "todos") return true
    if (filter === "rendimentos") return transaction.categoryId === YIELD_CATEGORY_ID
    return transaction.categoryId === CONTRIBUTION_CATEGORY_ID
  })

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
    setStatus("idle")
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const amount = parseAmount(form.amount)
    const nextErrors: string[] = []

    if (!Number.isFinite(amount) || amount <= 0) {
      nextErrors.push("Informe um valor maior que zero.")
    }
    if (form.description.trim().length < 2) {
      nextErrors.push("Descreva o lançamento com pelo menos 2 caracteres.")
    }

    if (nextErrors.length > 0) {
      setErrors(nextErrors)
      return
    }

    const meta = kindMeta(form.kind)
    setErrors([])
    setStatus("saving")

    try {
      await onCreate({
        date: form.date,
        description: form.description.trim(),
        categoryId: meta.categoryId,
        method: form.method,
        amount,
        type: meta.type,
        tag: form.tag.trim() || "investimento",
        note: "",
        recurring: form.kind === "aportes",
      })
      setForm((previous) => ({
        ...initialForm(today),
        kind: previous.kind,
        method: previous.method,
      }))
      setStatus("saved")
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : "Não foi possível salvar.",
      ])
      setStatus("idle")
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Landmark className="size-4 text-muted-foreground" />
          Investimentos
        </CardTitle>
        <CardDescription>
          Registre rendimentos recebidos e aportes feitos no período.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 rounded-lg border border-dashed p-3"
        >
          <p className="text-xs font-medium text-muted-foreground">Novo lançamento</p>

          <ToggleGroup
            type="single"
            value={form.kind}
            onValueChange={(value) => {
              if (value === "rendimentos" || value === "aportes") update("kind", value)
            }}
            variant="outline"
            className="w-full"
          >
            <ToggleGroupItem value="rendimentos" className="flex-1">
              Rendimento
            </ToggleGroupItem>
            <ToggleGroupItem value="aportes" className="flex-1">
              Aporte
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="invest-amount" className="text-xs">
                Valor
              </Label>
              <Input
                id="invest-amount"
                inputMode="decimal"
                placeholder="R$ 0,00"
                value={form.amount}
                onChange={(event) => update("amount", event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invest-date" className="text-xs">
                Data
              </Label>
              <Input
                id="invest-date"
                type="date"
                value={form.date}
                onChange={(event) => update("date", event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="invest-description" className="text-xs">
              Descrição
            </Label>
            <Input
              id="invest-description"
              placeholder={kindMeta(form.kind).placeholder}
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Método</Label>
              <Select
                value={form.method}
                onValueChange={(value) => update("method", value as PaymentMethod)}
              >
                <SelectTrigger className="w-full">
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
            <div className="space-y-1">
              <Label htmlFor="invest-tag" className="text-xs">
                Etiqueta
              </Label>
              <Input
                id="invest-tag"
                placeholder="renda-fixa"
                value={form.tag}
                onChange={(event) => update("tag", event.target.value)}
              />
            </div>
          </div>

          {errors.length > 0 ? (
            <ul className="space-y-1 text-sm text-destructive" role="alert">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}

          <Button type="submit" disabled={status === "saving"}>
            {status === "saving" ? (
              <Loader2 className="animate-spin" />
            ) : status === "saved" ? (
              <Check />
            ) : (
              <Plus />
            )}
            {status === "saving"
              ? "Salvando…"
              : status === "saved"
                ? "Salvo"
                : "Registrar"}
          </Button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Lançamentos no período
          </p>
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={(value) => {
              if (value === "todos" || value === "rendimentos" || value === "aportes") {
                setFilter(value)
              }
            }}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="todos">Todos</ToggleGroupItem>
            <ToggleGroupItem value="rendimentos">Rendimentos</ToggleGroupItem>
            <ToggleGroupItem value="aportes">Aportes</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="Nenhum investimento no período"
            description="Registre um rendimento ou aporte acima para começar."
          />
        ) : (
          <ul className="divide-y rounded-lg border">
            {visible.map((transaction) => {
              const category = getCategory(transaction.categoryId)
              const isYield = transaction.categoryId === YIELD_CATEGORY_ID
              return (
                <li
                  key={transaction.id}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {transaction.description}
                        {transaction.createdBy ? (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            · {transaction.createdBy}
                          </span>
                        ) : null}
                      </p>
                      <Badge variant="outline" className="font-normal">
                        {category.name}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDayMonth(transaction.date)}
                      {transaction.tag ? ` · ${transaction.tag}` : null}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-sm font-medium tabular",
                      isYield ? "text-positive" : "text-foreground"
                    )}
                  >
                    {isYield ? "+" : "−"}
                    {formatCurrency(transaction.amount)}
                  </p>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Excluir lançamento"
                    onClick={() => onDelete(transaction)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
