import { Droplets } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyState } from "@/components/finance/states"
import { formatCurrency } from "@/lib/format"

export type LeakItem = {
  tag: string
  spent: number
  count: number
}

/**
 * Small, frequent purchases are exactly what a monthly total hides, so they get
 * their own panel ranked by how much each habit costs.
 */
export function LeakPanel({ items }: { items: LeakItem[] }) {
  const peak = Math.max(1, ...items.map((item) => item.spent))

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Droplets className="size-4 text-muted-foreground" />
          Para onde o dinheiro vaza
        </CardTitle>
        <CardDescription>
          Etiquetas com maior gasto acumulado no período.
        </CardDescription>
      </CardHeader>

      <CardContent className={items.length === 0 ? "px-0" : undefined}>
        {items.length === 0 ? (
          <EmptyState
            title="Sem etiquetas ainda"
            description="Marque seus lançamentos com etiquetas para descobrir os padrões de gasto."
          />
        ) : (
          <ul className="space-y-2.5">
            {items.map((item) => (
              <li key={item.tag} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate">#{item.tag}</span>
                  <span className="shrink-0 font-medium tabular">
                    {formatCurrency(item.spent)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-chart-1"
                      style={{ width: `${(item.spent / peak) * 100}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs text-muted-foreground tabular">
                    {item.count} × {formatCurrency(item.spent / item.count)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
