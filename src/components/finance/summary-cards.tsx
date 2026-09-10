import {
  ArrowDownRight,
  ArrowUpRight,
  Landmark,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { percentChange, type Summary } from "@/lib/finance"
import { formatCurrency, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

type Tone = "neutral" | "positive" | "negative"

function Delta({
  value,
  /** For expenses, growth is bad — flip which direction gets the green. */
  invert = false,
  suffix,
}: {
  value: number
  invert?: boolean
  suffix: string
}) {
  const flat = Math.abs(value) < 0.5
  const good = invert ? value < 0 : value > 0
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <p className="flex items-center gap-1 text-xs text-muted-foreground">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 font-medium tabular",
          flat && "bg-muted text-muted-foreground",
          !flat && good && "bg-positive-muted text-positive",
          !flat && !good && "bg-negative-muted text-negative"
        )}
      >
        <Icon className="size-3" />
        {formatPercent(Math.abs(value), Math.abs(value) < 10 ? 1 : 0)}
      </span>
      {suffix}
    </p>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  children,
}: {
  label: string
  value: string
  icon: React.ElementType
  tone?: Tone
  children?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg",
              tone === "positive" && "bg-positive-muted text-positive",
              tone === "negative" && "bg-negative-muted text-negative",
              tone === "neutral" && "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="size-3.5" />
          </span>
        </div>
        <p
          className={cn(
            "font-heading text-2xl leading-none font-semibold tabular",
            tone === "positive" && "text-positive",
            tone === "negative" && "text-negative"
          )}
        >
          {value}
        </p>
        {children}
      </CardContent>
    </Card>
  )
}

export function SummaryCards({
  summary,
  periodLabel,
}: {
  summary: Summary
  periodLabel: string
}) {
  const incomeDelta = percentChange(summary.income, summary.previous.income)
  const expenseDelta = percentChange(summary.expense, summary.previous.expense)
  const yieldsDelta = percentChange(summary.yields, summary.previous.yields)
  const contributionsDelta = percentChange(
    summary.contributions,
    summary.previous.contributions
  )
  const comparison = `vs. ${periodLabel.toLowerCase()} anterior`

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Entradas"
        value={formatCurrency(summary.income)}
        icon={TrendingUp}
        tone="positive"
      >
        <Delta value={incomeDelta} suffix={comparison} />
      </StatCard>

      <StatCard
        label="Saídas"
        value={formatCurrency(summary.expense)}
        icon={TrendingDown}
        tone="negative"
      >
        <Delta value={expenseDelta} invert suffix={comparison} />
      </StatCard>

      <StatCard
        label="Rendimentos"
        value={formatCurrency(summary.yields)}
        icon={TrendingUp}
        tone="positive"
      >
        <Delta value={yieldsDelta} suffix={comparison} />
      </StatCard>

      <StatCard
        label="Aportes"
        value={formatCurrency(summary.contributions)}
        icon={Landmark}
        tone="neutral"
      >
        <Delta value={contributionsDelta} suffix={comparison} />
      </StatCard>
    </div>
  )
}
