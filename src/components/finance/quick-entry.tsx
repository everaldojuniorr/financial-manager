"use client"

import * as React from "react"
import { Check, Loader2, Plus } from "lucide-react"

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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories"
import { CASH_PAYMENT_METHODS } from "@/lib/types"
import type { NewTransaction, PaymentMethod, TransactionType } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Accepts `1.234,56`, `1234.56` and `1234,56` so nobody has to think about separators. */
export function parseAmount(input: string): number {
  const cleaned = input.replace(/[^\d.,-]/g, "")
  if (!cleaned) return NaN
  const lastComma = cleaned.lastIndexOf(",")
  const lastDot = cleaned.lastIndexOf(".")
  const decimalSeparator = lastComma > lastDot ? "," : lastDot > lastComma ? "." : ""
  if (!decimalSeparator) return Number(cleaned)
  const [integer, fraction] = cleaned.split(
    new RegExp(`\\${decimalSeparator}(?=[^\\${decimalSeparator}]*$)`)
  )
  return Number(`${integer.replace(/[.,]/g, "")}.${fraction}`)
}

type FormState = {
  type: TransactionType
  amount: string
  description: string
  categoryId: string
  method: PaymentMethod
  date: string
  tag: string
}

function initialState(today: string): FormState {
  return {
    type: "saida",
    amount: "",
    description: "",
    categoryId: "alimentacao",
    method: "pix",
    date: today,
    tag: "",
  }
}

export function QuickEntry({
  today,
  onCreate,
  layout = "card",
  incomeOnly = false,
}: {
  today: string
  onCreate: (input: NewTransaction) => Promise<void>
  layout?: "card" | "sheet"
  incomeOnly?: boolean
}) {
  const [form, setForm] = React.useState<FormState>(() => {
    const initial = initialState(today)
    if (!incomeOnly) return initial
    return { ...initial, type: "entrada", categoryId: INCOME_CATEGORIES[0]?.id ?? "salario" }
  })
  const [errors, setErrors] = React.useState<string[]>([])
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle")

  const categories = form.type === "entrada" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
    setStatus("idle")
  }

  function switchType(type: TransactionType) {
    const pool = type === "entrada" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    setForm((previous) => ({ ...previous, type, categoryId: pool[0].id }))
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

    setErrors([])
    setStatus("saving")

    try {
      await onCreate({
        date: form.date,
        description: form.description.trim(),
        categoryId: form.categoryId,
        method: form.method,
        amount,
        type: form.type,
        tag: form.tag.trim(),
        note: "",
        recurring: false,
      })
      setForm((previous) => ({
        ...initialState(today),
        type: previous.type,
        categoryId: previous.categoryId,
        method: previous.method,
        date: previous.date,
      }))
      setStatus("saved")
    } catch (error) {
      setStatus("idle")
      setErrors([
        error instanceof Error ? error.message : "Não foi possível salvar agora.",
      ])
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("space-y-3", layout === "sheet" && "px-4 pb-4")}
      noValidate
    >
      {!incomeOnly && (
        <ToggleGroup
          type="single"
          value={form.type}
          onValueChange={(value) => value && switchType(value as TransactionType)}
          variant="outline"
          spacing={0}
          className="w-full *:flex-1"
        >
          <ToggleGroupItem
            value="saida"
            className="data-[state=on]:bg-negative-muted data-[state=on]:text-negative"
          >
            Saída
          </ToggleGroupItem>
          <ToggleGroupItem
            value="entrada"
            className="data-[state=on]:bg-positive-muted data-[state=on]:text-positive"
          >
            Entrada
          </ToggleGroupItem>
        </ToggleGroup>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="amount">Valor</Label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
            R$
          </span>
          <Input
            id="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={form.amount}
            onChange={(event) => update("amount", event.target.value)}
            className="pl-8 text-base font-medium tabular"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição</Label>
        <Input
          id="description"
          autoComplete="off"
          placeholder={
            form.type === "entrada" ? "Freela — landing page" : "Almoço no self-service"
          }
          value={form.description}
          onChange={(event) => update("description", event.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="category">Categoria</Label>
          <Select
            value={form.categoryId}
            onValueChange={(value) => update("categoryId", value)}
          >
            <SelectTrigger id="category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="method">Método</Label>
          <Select
            value={form.method}
            onValueChange={(value) => update("method", value as PaymentMethod)}
          >
            <SelectTrigger id="method" className="w-full">
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

        <div className="space-y-1.5">
          <Label htmlFor="date">Data</Label>
          <Input
            id="date"
            type="date"
            value={form.date}
            max={today}
            onChange={(event) => update("date", event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tag">Etiqueta</Label>
          <Input
            id="tag"
            autoComplete="off"
            placeholder="mercado"
            value={form.tag}
            onChange={(event) => update("tag", event.target.value)}
          />
        </div>
      </div>

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        {incomeOnly
          ? "Salário, freelance e reembolso. Gastos ficam nas dívidas e nas faturas."
          : "Compras no cartão de crédito são lançadas dentro da fatura, não aqui."}
      </p>

      <Button type="submit" className="w-full" disabled={status === "saving"}>
        {status === "saving" ? (
          <Loader2 className="animate-spin" />
        ) : status === "saved" ? (
          <Check />
        ) : (
          <Plus />
        )}
        {status === "saving"
          ? "Registrando..."
          : status === "saved"
            ? "Registrado — lançar outro"
            : "Registrar lançamento"}
      </Button>
    </form>
  )
}
