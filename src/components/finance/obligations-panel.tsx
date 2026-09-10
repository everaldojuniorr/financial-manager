"use client"

import * as React from "react"
import { Copy, Plus } from "lucide-react"

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
import { parseAmount } from "@/components/finance/quick-entry"
import { formatCompetence, formatCurrency } from "@/lib/format"
import { getSegment, SEGMENTS } from "@/lib/segments"
import {
  OBLIGATION_KIND_LABEL,
  type Obligation,
  type ObligationEntry,
  type ObligationKind,
  type SegmentId,
} from "@/lib/types"

function amountLabel(amount: number | null) {
  if (amount == null) return ""
  return amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function ObligationsPanel({
  kind,
  competence,
  obligations,
  entries,
  onCreate,
  onArchive,
  onSaveEntry,
  onCopyPrevious,
}: {
  kind: ObligationKind
  competence: string
  obligations: Obligation[]
  entries: ObligationEntry[]
  onCreate: (input: { name: string; segment: SegmentId }) => Promise<void>
  onArchive: (id: string) => Promise<void>
  onSaveEntry: (input: {
    obligationId: string
    amount: number | null
    paid: boolean
  }) => Promise<void>
  onCopyPrevious?: () => Promise<void>
}) {
  const rows = obligations.filter((item) => item.kind === kind && item.active)
  const byObligation = new Map(
    entries
      .filter((entry) => entry.competence === competence)
      .map((entry) => [entry.obligationId, entry])
  )
  const total = rows.reduce((sum, row) => sum + (byObligation.get(row.id)?.amount ?? 0), 0)
  const year = competence.slice(0, 4)
  const paidThisYear = entries.reduce((sum, entry) => {
    if (!entry.paid || entry.amount == null) return sum
    if (!entry.competence.startsWith(year)) return sum
    const obligation = obligations.find((item) => item.id === entry.obligationId)
    if (!obligation || obligation.kind !== kind) return sum
    return sum + entry.amount
  }, 0)

  const [name, setName] = React.useState("")
  const [segment, setSegment] = React.useState<SegmentId>(
    kind === "emprestimo" ? "emprestimos" : kind === "variavel" ? "imprevistos" : "moradia"
  )
  const [errors, setErrors] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (name.trim().length < 2) {
      setErrors(["Informe um nome com pelo menos 2 caracteres."])
      return
    }
    setSaving(true)
    setErrors([])
    try {
      await onCreate({ name: name.trim(), segment })
      setName("")
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Não foi possível criar."])
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{OBLIGATION_KIND_LABEL[kind]}</CardTitle>
        <CardDescription>
          {formatCompetence(competence)}. Linha em branco não entra no total do mês.
        </CardDescription>
        {onCopyPrevious && (
          <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
            <Button size="sm" variant="outline" onClick={() => void onCopyPrevious()}>
              <Copy />
              Copiar mês anterior
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma linha ativa neste grupo.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {rows.map((row) => {
              const entry = byObligation.get(row.id) ?? null
              return (
                <ObligationRow
                  key={row.id}
                  obligation={row}
                  amount={entry?.amount ?? null}
                  paid={entry?.paid ?? false}
                  onSave={(next) =>
                    onSaveEntry({
                      obligationId: row.id,
                      amount: next.amount,
                      paid: next.paid,
                    })
                  }
                  onArchive={() => onArchive(row.id)}
                />
              )
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Total do mês{" "}
            <span className="font-medium text-foreground tabular">{formatCurrency(total)}</span>
          </p>
          {kind === "emprestimo" && (
            <p className="text-sm text-muted-foreground">
              Pago em {year}{" "}
              <span className="font-medium text-foreground tabular">
                {formatCurrency(paidThisYear)}
              </span>
            </p>
          )}
        </div>

        <form onSubmit={handleCreate} className="grid gap-3 rounded-lg border border-dashed p-3">
          <p className="text-xs font-medium text-muted-foreground">Nova linha</p>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor={`new-${kind}`}>Nome</Label>
              <Input
                id={`new-${kind}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: financiamento"
              />
            </div>
            <div className="space-y-1">
              <Label>Segmento</Label>
              <Select
                value={segment}
                onValueChange={(value) => setSegment(value as SegmentId)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={saving}>
              <Plus />
              Adicionar
            </Button>
          </div>
          {errors.length > 0 && (
            <p className="text-xs text-destructive" role="alert">
              {errors[0]}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

function ObligationRow({
  obligation,
  amount,
  paid,
  onSave,
  onArchive,
}: {
  obligation: Obligation
  amount: number | null
  paid: boolean
  onSave: (input: { amount: number | null; paid: boolean }) => Promise<void>
  onArchive: () => Promise<void>
}) {
  const [draft, setDraft] = React.useState(amountLabel(amount))
  const [error, setError] = React.useState("")
  const segment = getSegment(obligation.segment)

  React.useEffect(() => {
    setDraft(amountLabel(amount))
  }, [amount])

  async function commit(nextPaid = paid) {
    const trimmed = draft.trim()
    if (!trimmed) {
      setError("")
      if (amount !== null || nextPaid !== paid) {
        await onSave({ amount: null, paid: nextPaid })
      }
      return
    }
    const parsed = parseAmount(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Valor inválido.")
      return
    }
    setError("")
    const nextAmount = parsed === 0 ? null : Math.round(parsed * 100) / 100
    if (nextAmount === amount && nextPaid === paid) return
    try {
      await onSave({ amount: nextAmount, paid: nextPaid })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar.")
    }
  }

  return (
    <li className="grid gap-3 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_140px_auto_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate font-medium">{obligation.name}</p>
        <Badge variant="outline" className="mt-1 font-normal">
          {segment.name}
        </Badge>
      </div>
      <Input
        inputMode="decimal"
        aria-label={`Valor de ${obligation.name}`}
        placeholder="Em branco"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
      />
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={paid}
          onChange={(event) => void commit(event.target.checked)}
        />
        Pago
      </label>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          if (window.confirm(`Arquivar “${obligation.name}”? Os meses já preenchidos continuam no histórico.`)) {
            void onArchive()
          }
        }}
      >
        Arquivar
      </Button>
      {error && <p className="text-xs text-destructive sm:col-span-4">{error}</p>}
    </li>
  )
}
