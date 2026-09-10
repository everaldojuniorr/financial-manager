"use client"

import * as React from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { DailyPoint } from "@/lib/finance"
import {
  formatCompact,
  formatCurrency,
  formatDayMonth,
  formatWeekday,
} from "@/lib/format"
import { cn } from "@/lib/utils"

type ChartMode = "diario" | "acumulado"

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function DivergingBars({
  points,
  hovered,
  onHover,
}: {
  points: DailyPoint[]
  hovered: number | null
  onHover: (index: number | null) => void
}) {
  const peak = Math.max(
    1,
    ...points.map((point) => Math.max(point.income, point.expense))
  )

  return (
    <div className="flex h-56 items-stretch gap-px" onMouseLeave={() => onHover(null)}>
      {points.map((point, index) => {
        const active = hovered === index
        return (
          <button
            key={point.date}
            type="button"
            onMouseEnter={() => onHover(index)}
            onFocus={() => onHover(index)}
            aria-label={`${formatDayMonth(point.date)}: entradas ${formatCurrency(
              point.income
            )}, saídas ${formatCurrency(point.expense)}`}
            className={cn(
              "group/bar relative flex min-w-0 flex-1 cursor-pointer flex-col rounded-sm outline-none",
              active && "bg-foreground/5"
            )}
          >
            <span className="flex flex-1 items-end justify-center px-px">
              <span
                className={cn(
                  "w-full rounded-t-[2px] bg-positive/75 transition-all",
                  active && "bg-positive"
                )}
                style={{ height: `${(point.income / peak) * 100}%` }}
              />
            </span>
            <span className="h-px w-full bg-border" />
            <span className="flex flex-1 items-start justify-center px-px">
              <span
                className={cn(
                  "w-full rounded-b-[2px] bg-negative/70 transition-all",
                  active && "bg-negative"
                )}
                style={{ height: `${(point.expense / peak) * 100}%` }}
              />
            </span>
          </button>
        )
      })}
    </div>
  )
}

function CumulativeLine({
  points,
  hovered,
  onHover,
}: {
  points: DailyPoint[]
  hovered: number | null
  onHover: (index: number | null) => void
}) {
  const cumulative = React.useMemo(() => {
    const values: number[] = []
    let running = 0
    for (const point of points) {
      running += point.net
      values.push(running)
    }
    return values
  }, [points])

  const max = Math.max(...cumulative, 0)
  const min = Math.min(...cumulative, 0)
  const span = max - min || 1

  const toY = (value: number) => 100 - ((value - min) / span) * 100
  const toX = (index: number) =>
    points.length > 1 ? (index / (points.length - 1)) * 100 : 50

  const line = cumulative.map((value, index) => `${toX(index)},${toY(value)}`).join(" ")
  const area = `0,${toY(min)} ${line} 100,${toY(min)}`
  const zeroY = toY(0)

  return (
    <div className="relative h-56" onMouseLeave={() => onHover(null)}>
      <svg
        className="h-full w-full overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="cumulative-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--positive)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--positive)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line
          x1="0"
          x2="100"
          y1={zeroY}
          y2={zeroY}
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
        <polygon points={area} fill="url(#cumulative-fill)" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--positive)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {hovered !== null && (
          <>
            <line
              x1={toX(hovered)}
              x2={toX(hovered)}
              y1="0"
              y2="100"
              stroke="var(--foreground)"
              strokeOpacity="0.25"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={toX(hovered)}
              cy={toY(cumulative[hovered])}
              r="3"
              fill="var(--positive)"
              stroke="var(--card)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
      <div className="absolute inset-0 flex">
        {points.map((point, index) => (
          <button
            key={point.date}
            type="button"
            className="min-w-0 flex-1 cursor-pointer outline-none"
            onMouseEnter={() => onHover(index)}
            onFocus={() => onHover(index)}
            aria-label={`${formatDayMonth(point.date)}: saldo acumulado ${formatCurrency(
              cumulative[index]
            )}`}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute top-0 left-0 text-[10px] text-muted-foreground tabular">
        {formatCompact(max)}
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 text-[10px] text-muted-foreground tabular">
        {formatCompact(min)}
      </div>
    </div>
  )
}

export function CashFlowChart({
  points,
  periodLabel,
}: {
  points: DailyPoint[]
  periodLabel: string
}) {
  const [mode, setMode] = React.useState<ChartMode>("diario")
  const [hovered, setHovered] = React.useState<number | null>(null)

  const cumulativeAtHover = React.useMemo(() => {
    if (hovered === null) return 0
    return points
      .slice(0, hovered + 1)
      .reduce((sum, point) => sum + point.net, 0)
  }, [hovered, points])

  const busiest = points.reduce(
    (max, point) => (point.expense > max.expense ? point : max),
    points[0]
  )

  // Roughly eight ticks regardless of how long the window is.
  const tickEvery = Math.max(1, Math.ceil(points.length / 8))
  const active = hovered === null ? null : points[hovered]

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Fluxo de caixa diário</CardTitle>
        <CardDescription>
          {mode === "diario"
            ? "Entradas acima da linha, saídas abaixo — dia a dia."
            : "Quanto sobrou (ou faltou) somando o período dia após dia."}
        </CardDescription>
        <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
          <ToggleGroup
            type="single"
            size="sm"
            value={mode}
            onValueChange={(value) => value && setMode(value as ChartMode)}
            variant="outline"
          >
            <ToggleGroupItem value="diario">Diário</ToggleGroupItem>
            <ToggleGroupItem value="acumulado">Acumulado</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-positive" />
            Entradas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-negative" />
            Saídas
          </span>
          <span className="ml-auto hidden sm:inline">
            Maior gasto do período em{" "}
            <span className="font-medium text-foreground">
              {formatDayMonth(busiest.date)}
            </span>{" "}
            ({formatCurrency(busiest.expense)})
          </span>
        </div>

        <div className="relative">
          {active && (
            <div
              className="pointer-events-none absolute -top-1 z-20 w-46 -translate-x-1/2 rounded-lg bg-popover p-2.5 text-xs shadow-lg ring-1 ring-foreground/10"
              style={{
                left: `${clamp(
                  ((hovered! + 0.5) / points.length) * 100,
                  14,
                  86
                )}%`,
              }}
            >
              <p className="font-medium capitalize">
                {formatWeekday(active.date)}, {formatDayMonth(active.date)}
              </p>
              <dl className="mt-1.5 space-y-1">
                {mode === "diario" ? (
                  <>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Entradas</dt>
                      <dd className="font-medium text-positive tabular">
                        {formatCurrency(active.income)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Saídas</dt>
                      <dd className="font-medium text-negative tabular">
                        {formatCurrency(active.expense)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 border-t pt-1">
                      <dt className="text-muted-foreground">Saldo do dia</dt>
                      <dd
                        className={cn(
                          "font-medium tabular",
                          active.net >= 0 ? "text-positive" : "text-negative"
                        )}
                      >
                        {formatCurrency(active.net)}
                      </dd>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Acumulado</dt>
                    <dd
                      className={cn(
                        "font-medium tabular",
                        cumulativeAtHover >= 0 ? "text-positive" : "text-negative"
                      )}
                    >
                      {formatCurrency(cumulativeAtHover)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Lançamentos</dt>
                  <dd className="tabular">{active.count}</dd>
                </div>
              </dl>
            </div>
          )}

          {mode === "diario" ? (
            <DivergingBars points={points} hovered={hovered} onHover={setHovered} />
          ) : (
            <CumulativeLine points={points} hovered={hovered} onHover={setHovered} />
          )}
        </div>

        <div className="flex justify-between text-[10px] text-muted-foreground tabular">
          {points
            .filter((_, index) => index % tickEvery === 0)
            .map((point) => (
              <span key={point.date}>{formatDayMonth(point.date)}</span>
            ))}
        </div>
        <p className="sr-only">
          Série de {points.length} dias referente a {periodLabel}.
        </p>
      </CardContent>
    </Card>
  )
}
