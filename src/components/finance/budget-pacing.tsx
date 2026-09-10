import { CalendarClock, CircleCheck, Gauge, TriangleAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Pacing } from "@/lib/finance"
import { formatCurrency, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

export function BudgetPacing({ pacing }: { pacing: Pacing }) {
  const used = pacing.budget > 0 ? (pacing.spent / pacing.budget) * 100 : 0
  const expected =
    pacing.budget > 0 ? (pacing.expectedByNow / pacing.budget) * 100 : 0

  // A window with no days left is history: report the outcome, not a forecast.
  const closed = pacing.daysLeft === 0
  const overshoot = (closed ? pacing.spent : pacing.projected) - pacing.budget
  const withinBudget = overshoot <= 0

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Gauge className="size-4 text-muted-foreground" />
          Ritmo de gasto
        </CardTitle>
        <CardDescription>
          {closed
            ? "Como o orçamento do período foi consumido."
            : "O quanto do orçamento já queimou e o que ainda pode gastar por dia."}
        </CardDescription>
        <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
          {closed ? (
            <Badge
              variant={withinBudget ? "secondary" : "destructive"}
              className={cn(withinBudget && "bg-positive-muted text-positive")}
            >
              {withinBudget ? "Dentro do orçamento" : "Estourou"}
            </Badge>
          ) : (
            <Badge
              variant={pacing.onTrack ? "secondary" : "destructive"}
              className={cn(pacing.onTrack && "bg-positive-muted text-positive")}
            >
              {pacing.onTrack ? "No ritmo" : "Acelerado"}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-heading text-xl font-semibold tabular">
              {formatCurrency(pacing.spent)}
            </span>
            <span className="text-xs text-muted-foreground tabular">
              de {formatCurrency(pacing.budget)}
            </span>
          </div>

          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                used > 100
                  ? "bg-negative"
                  : closed || pacing.onTrack
                    ? "bg-positive"
                    : "bg-chart-2"
              )}
              style={{ width: `${Math.min(used, 100)}%` }}
            />
            {!closed && (
              // Where an evenly paced period would put you today.
              <div
                className="absolute inset-y-0 w-0.5 bg-foreground/60"
                style={{ left: `${Math.min(expected, 100)}%` }}
                title="Ritmo ideal para hoje"
              />
            )}
          </div>

          <div className="flex justify-between gap-2 text-xs text-muted-foreground">
            <span className="tabular">{formatPercent(used, 1)} consumido</span>
            {!closed && <span>Marca preta = ritmo ideal de hoje</span>}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-muted/60 p-2.5">
            <dt className="text-xs text-muted-foreground">
              {closed ? "Sobra do período" : "Pode gastar por dia"}
            </dt>
            <dd
              className={cn(
                "font-heading text-base font-semibold tabular",
                closed
                  ? pacing.remaining >= 0
                    ? "text-positive"
                    : "text-negative"
                  : pacing.remaining <= 0 && "text-negative"
              )}
            >
              {formatCurrency(closed ? pacing.remaining : pacing.dailyAllowance)}
            </dd>
          </div>
          <div className="rounded-lg bg-muted/60 p-2.5">
            <dt className="text-xs text-muted-foreground">
              {closed ? "Média diária" : "Média diária atual"}
            </dt>
            <dd className="font-heading text-base font-semibold tabular">
              {formatCurrency(pacing.averageDailyBurn)}
            </dd>
          </div>
        </dl>

        <div className="flex items-start gap-2 rounded-lg border border-dashed p-2.5 text-xs">
          {!withinBudget ? (
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-negative" />
          ) : closed ? (
            <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-positive" />
          ) : (
            <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          )}

          {closed ? (
            <p className="text-muted-foreground">
              O período fechou{" "}
              {withinBudget ? (
                <>
                  <span className="font-medium text-positive">
                    {formatCurrency(Math.abs(overshoot))} abaixo
                  </span>{" "}
                  do orçamento
                </>
              ) : (
                <>
                  <span className="font-medium text-negative">
                    {formatCurrency(overshoot)} acima
                  </span>{" "}
                  do orçamento
                </>
              )}
              , com{" "}
              <span className="font-medium text-foreground tabular">
                {formatCurrency(pacing.budget)}
              </span>{" "}
              previstos para {pacing.daysTotal} dias.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Mantendo esse ritmo, o período fecha em{" "}
              <span className="font-medium text-foreground tabular">
                {formatCurrency(pacing.projected)}
              </span>
              {withinBudget ? (
                <>
                  {" "}
                  — <span className="font-medium text-positive">
                    {formatCurrency(Math.abs(overshoot))} de folga
                  </span>
                  .
                </>
              ) : (
                <>
                  {" "}
                  — <span className="font-medium text-negative">
                    {formatCurrency(overshoot)} acima
                  </span>{" "}
                  do orçamento.
                </>
              )}{" "}
              Restam{" "}
              <span className="font-medium text-foreground tabular">
                {pacing.daysLeft}
              </span>{" "}
              dias.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
