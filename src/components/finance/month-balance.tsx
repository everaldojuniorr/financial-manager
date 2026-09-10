import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatSigned } from "@/lib/format"
import type { Summary } from "@/lib/finance"
import { cn } from "@/lib/utils"

export function MonthBalance({ summary }: { summary: Summary }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Balanço</CardTitle>
        <CardDescription>
          O que entrou e o que saiu no período. Aportes não entram nas saídas.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Entrou
          </p>
          <p className="font-heading text-2xl font-semibold text-positive tabular">
            {formatCurrency(summary.income)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Saiu
          </p>
          <p className="font-heading text-2xl font-semibold text-negative tabular">
            {formatCurrency(summary.expense)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Saldo
          </p>
          <p
            className={cn(
              "font-heading text-2xl font-semibold tabular",
              summary.balance >= 0 ? "text-positive" : "text-negative"
            )}
          >
            {formatSigned(summary.balance)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
