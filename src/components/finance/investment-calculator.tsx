"use client"

import * as React from "react"
import { Info, Minus, Plus } from "lucide-react"

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
import { formatCurrency } from "@/lib/format"
import {
  CALCULATOR_DEFAULTS,
  formatRatePercent,
  savingsMonthlyFromRules,
  simulateInvestments,
  totalInvested,
  type CalculatorInput,
  type PeriodUnit,
  type YieldMode,
} from "@/lib/investment-calc"
import { cn } from "@/lib/utils"

function moneyDraft(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function percentDraft(value: number, digits = 2) {
  return value.toFixed(digits).replace(".", ",")
}

export function InvestmentCalculator() {
  const [form, setForm] = React.useState<CalculatorInput>(CALCULATOR_DEFAULTS)
  const [showDetail, setShowDetail] = React.useState(false)

  function update<K extends keyof CalculatorInput>(key: K, value: CalculatorInput[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value }
      if (key === "selic" || key === "tr") {
        next.savings =
          Math.round(savingsMonthlyFromRules(next.selic, next.tr) * 1_000_000) / 10_000
      }
      return next
    })
  }

  const results = simulateInvestments(form)
  const invested = totalInvested(form)
  const maxNet = Math.max(...results.map((item) => item.net), 1)

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Que aplicação rende mais?</CardTitle>
        <CardDescription>
          Simulação com juros constantes. Não grava nada no extrato.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MoneyField
              id="calc-initial"
              label="Investimento inicial"
              value={form.initial}
              onChange={(value) => update("initial", value)}
            />
            <MoneyField
              id="calc-monthly"
              label="Aportes mensais"
              value={form.monthly}
              onChange={(value) => update("monthly", value)}
            />
            <div className="space-y-1">
              <Label>Período da aplicação</Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label="Diminuir período"
                  onClick={() => update("period", Math.max(1, form.period - 1))}
                >
                  <Minus />
                </Button>
                <Input
                  inputMode="numeric"
                  className="text-center tabular"
                  value={String(form.period)}
                  onChange={(event) => {
                    const next = Number(event.target.value.replace(/\D/g, ""))
                    if (Number.isFinite(next)) update("period", Math.max(1, next))
                  }}
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label="Aumentar período"
                  onClick={() => update("period", form.period + 1)}
                >
                  <Plus />
                </Button>
                <Select
                  value={form.periodUnit}
                  onValueChange={(value) => update("periodUnit", value as PeriodUnit)}
                >
                  <SelectTrigger className="w-24" aria-label="Unidade do período">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anos">anos</SelectItem>
                    <SelectItem value="meses">meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PercentField
              id="calc-selic"
              label="Selic efetiva (a.a.)"
              hint="Usada no Tesouro Selic e na regra da poupança."
              value={form.selic}
              onChange={(value) => update("selic", value)}
            />
            <PercentField
              id="calc-cdi"
              label="CDI (a.a.)"
              hint="Referência de CDB, LCI/LCA e Fundo DI."
              value={form.cdi}
              onChange={(value) => update("cdi", value)}
            />
            <PercentField
              id="calc-ipca"
              label="IPCA (a.a.)"
              hint="Inflação constante e parte do Tesouro IPCA+."
              value={form.ipca}
              onChange={(value) => update("ipca", value)}
            />
            <PercentField
              id="calc-tr"
              label="TR (a.m.)"
              hint="Entra na remuneração da poupança."
              value={form.tr}
              digits={4}
              onChange={(value) => update("tr", value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <PercentField
              id="calc-prefix"
              label="Juro nominal do Tesouro Prefixado (a.a.)"
              value={form.prefixado}
              onChange={(value) => update("prefixado", value)}
            />
            <PercentField
              id="calc-custody"
              label="Taxa de custódia da B3 no Tesouro Direto (a.a.)"
              value={form.custody}
              digits={2}
              onChange={(value) => update("custody", value)}
            />
            <PercentField
              id="calc-ipca-plus"
              label="Juro real do Tesouro IPCA+ (a.a.)"
              value={form.ipcaPlus}
              onChange={(value) => update("ipcaPlus", value)}
            />
            <div className="space-y-1">
              <Label htmlFor="calc-admin">Taxa de administração do Fundo DI (a.a.)</Label>
              <div className="flex items-center gap-1">
                <Input
                  id="calc-admin"
                  inputMode="decimal"
                  value={percentDraft(form.fundAdmin)}
                  onChange={(event) => update("fundAdmin", parseAmount(event.target.value) || 0)}
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label="Diminuir taxa"
                  onClick={() => update("fundAdmin", Math.max(0, round(form.fundAdmin - 0.05)))}
                >
                  <Minus />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label="Aumentar taxa"
                  onClick={() => update("fundAdmin", round(form.fundAdmin + 0.05))}
                >
                  <Plus />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <YieldField
              id="calc-cdb"
              label="Rentabilidade do CDB"
              value={form.cdbYield}
              mode={form.cdbMode}
              onValue={(value) => update("cdbYield", value)}
              onMode={(mode) => update("cdbMode", mode)}
            />
            <PercentField
              id="calc-fund"
              label="Rentabilidade do Fundo DI (% do CDI)"
              value={form.fundDi}
              digits={2}
              onChange={(value) => update("fundDi", value)}
            />
            <YieldField
              id="calc-lci"
              label="Rentabilidade da LCI/LCA"
              value={form.lciYield}
              mode={form.lciMode}
              onValue={(value) => update("lciYield", value)}
              onMode={(mode) => update("lciMode", mode)}
            />
            <PercentField
              id="calc-savings"
              label="Rentabilidade da Poupança (a.m.)"
              hint={`Regra atual: ${formatRatePercent(savingsMonthlyFromRules(form.selic, form.tr))} ao mês.`}
              value={form.savings}
              digits={4}
              onChange={(value) => update("savings", value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Esses são os parâmetros da simulação. Juros e inflação ficam constantes. O IR
            segue a tabela regressiva no resgate. Tesouro desconta a custódia da B3 sobre o
            valor bruto; Fundo DI desconta a taxa de administração do mesmo jeito. LCI, LCA e
            poupança são isentos. A correção pelo IPCA não é uma aplicação.
          </p>
        </div>

          <div className="space-y-4 rounded-xl bg-muted/40 p-4">
          <p className="text-sm">
            Total investido:{" "}
            <span className="font-semibold tabular text-[oklch(0.62_0.16_230)]">
              {formatCurrency(invested)}
            </span>
          </p>
          <div>
            <h3 className="font-heading text-lg font-semibold">Melhores opções de investimento</h3>
            <p className="text-sm text-muted-foreground">Valor líquido de resgate</p>
          </div>
          <ul className="space-y-3">
            {results.map((item) => (
              <li key={item.id} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2">
                <span className="truncate text-sm">{item.name}</span>
                <div className="flex min-w-0 items-center gap-2">
                  <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-sm bg-background">
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${Math.max(4, (item.net / maxNet) * 100)}%`,
                        backgroundColor: item.benchmark ? "#9082bc" : "#00aeef",
                      }}
                    />
                  </div>
                  <span className="w-28 shrink-0 text-right text-xs font-medium tabular">
                    {formatCurrency(item.net)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            className="border-[#9082bc] text-[#6d5cae]"
            onClick={() => setShowDetail((current) => !current)}
          >
            {showDetail ? "Ocultar simulação" : "Ver simulação"}
          </Button>
          {showDetail && (
            <ul className="space-y-3 text-sm">
              {results.map((item) => (
                <li key={item.id} className="rounded-lg border bg-background p-3">
                  <p className="font-medium">{item.name}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <dt>Valor bruto</dt>
                    <dd className="text-right text-foreground tabular">{formatCurrency(item.gross)}</dd>
                    <dt>Rentabilidade bruta</dt>
                    <dd className="text-right text-foreground tabular">
                      {item.grossReturn.toFixed(2).replace(".", ",")} %
                    </dd>
                    <dt>Custos</dt>
                    <dd className="text-right text-foreground tabular">{formatCurrency(item.costs)}</dd>
                    <dt>IR</dt>
                    <dd className="text-right text-foreground tabular">{formatCurrency(item.ir)}</dd>
                    <dt>Valor líquido</dt>
                    <dd className="text-right font-medium text-foreground tabular">
                      {formatCurrency(item.net)}
                    </dd>
                    <dt>Rentabilidade líquida</dt>
                    <dd className="text-right text-foreground tabular">
                      {item.netReturn.toFixed(2).replace(".", ",")} %
                    </dd>
                    <dt>Ganho líquido</dt>
                    <dd
                      className={cn(
                        "text-right tabular",
                        item.gain >= 0 ? "text-positive" : "text-negative"
                      )}
                    >
                      {formatCurrency(item.gain)}
                    </dd>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function MoneyField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = React.useState(moneyDraft(value))

  React.useEffect(() => {
    setDraft(moneyDraft(value))
  }, [value])

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
          R$
        </span>
        <Input
          id={id}
          inputMode="decimal"
          className="pl-8 tabular"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            const parsed = parseAmount(draft)
            if (!Number.isFinite(parsed) || parsed < 0) {
              setDraft(moneyDraft(value))
              return
            }
            onChange(parsed)
          }}
        />
      </div>
    </div>
  )
}

function PercentField({
  id,
  label,
  hint,
  value,
  digits = 2,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  value: number
  digits?: number
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = React.useState(percentDraft(value, digits))

  React.useEffect(() => {
    setDraft(percentDraft(value, digits))
  }, [value, digits])

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {hint && (
          <span title={hint} className="text-muted-foreground">
            <Info className="size-3" />
          </span>
        )}
      </Label>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          className="pr-7 tabular"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            const parsed = parseAmount(draft)
            if (!Number.isFinite(parsed) || parsed < 0) {
              setDraft(percentDraft(value, digits))
              return
            }
            onChange(parsed)
          }}
        />
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">
          %
        </span>
      </div>
    </div>
  )
}

function YieldField({
  id,
  label,
  value,
  mode,
  onValue,
  onMode,
}: {
  id: string
  label: string
  value: number
  mode: YieldMode
  onValue: (value: number) => void
  onMode: (mode: YieldMode) => void
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          inputMode="decimal"
          className="tabular"
          value={percentDraft(value, 2)}
          onChange={(event) => onValue(parseAmount(event.target.value) || 0)}
        />
        <Select value={mode} onValueChange={(next) => onMode(next as YieldMode)}>
          <SelectTrigger className="w-32" aria-label="Unidade da rentabilidade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cdi">% do CDI</SelectItem>
            <SelectItem value="aa">% a.a.</SelectItem>
            <SelectItem value="ipca">IPCA +</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
