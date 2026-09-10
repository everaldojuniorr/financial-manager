import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyState } from "@/components/finance/states"
import type { SegmentUsage } from "@/lib/finance"
import { formatCurrency, formatPercent } from "@/lib/format"

export function SegmentBreakdown({ usage }: { usage: SegmentUsage[] }) {
  const total = usage.reduce((sum, item) => sum + item.spent, 0)

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Gastos por segmento</CardTitle>
        <CardDescription>
          {total > 0
            ? `${formatCurrency(total)} no período, sem contar o pagamento da fatura duas vezes.`
            : "Dívidas e faturas do período, agrupadas."}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {usage.length === 0 ? (
          <EmptyState
            title="Nenhum gasto neste período"
            description="Preencha as dívidas do mês ou o valor da fatura para ver a divisão."
          />
        ) : (
          <ul className="divide-y">
            {usage.map((item) => (
              <li key={item.id} className="space-y-1.5 px-(--card-spacing) py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate text-sm font-medium">{item.name}</span>
                  <span className="ml-auto shrink-0 text-sm font-medium tabular">
                    {formatCurrency(item.spent)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(item.share, 100)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground tabular">
                  {item.count} lanç. · {formatPercent(item.share)} do total
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
