"use client"

import { Filter, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyState } from "@/components/finance/states"
import { CATEGORY_KIND_LABEL } from "@/lib/types"
import type { CategoryUsage } from "@/lib/finance"
import { formatCurrency, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

export function CategoryBreakdown({
  usage,
  selectedCategory,
  onSelectCategory,
}: {
  usage: CategoryUsage[]
  selectedCategory: string
  onSelectCategory: (categoryId: string) => void
}) {
  const active = usage.filter((item) => item.count > 0)
  const overBudget = active.filter((item) => item.overBudget)

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Gasto por categoria</CardTitle>
        <CardDescription>
          {overBudget.length > 0
            ? `${overBudget.length} categoria${
                overBudget.length > 1 ? "s" : ""
              } acima do orçamento.`
            : "Todas as categorias dentro do orçamento."}
        </CardDescription>
        {selectedCategory !== "todas" && (
          <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
            <Button
              size="xs"
              variant="ghost"
              onClick={() => onSelectCategory("todas")}
            >
              <X />
              Limpar
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="px-0">
        {active.length === 0 ? (
          <EmptyState
            title="Nenhuma saída registrada"
            description="Assim que houver gastos no período, a divisão por categoria aparece aqui."
          />
        ) : (
          <ul className="divide-y">
            {active.map((item) => {
              const isSelected = selectedCategory === item.category.id
              return (
                <li key={item.category.id}>
                  <button
                    type="button"
                    onClick={() =>
                      onSelectCategory(isSelected ? "todas" : item.category.id)
                    }
                    aria-pressed={isSelected}
                    className={cn(
                      "w-full cursor-pointer space-y-1.5 px-(--card-spacing) py-2.5 text-left transition-colors hover:bg-muted/60",
                      isSelected && "bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-[3px]"
                        style={{ backgroundColor: item.category.color }}
                      />
                      <span className="truncate text-sm font-medium">
                        {item.category.name}
                      </span>
                      {isSelected && (
                        <Filter className="size-3 shrink-0 text-muted-foreground" />
                      )}
                      <span className="ml-auto shrink-0 text-sm font-medium tabular">
                        {formatCurrency(item.spent)}
                      </span>
                    </div>

                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(item.usage, 100)}%`,
                          backgroundColor: item.overBudget
                            ? "var(--negative)"
                            : item.category.color,
                        }}
                      />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="ghost" className="px-0 text-muted-foreground">
                        {CATEGORY_KIND_LABEL[item.category.kind]}
                      </Badge>
                      <span className="tabular">{item.count} lanç.</span>
                      <span className="tabular">
                        {formatPercent(item.share)} do total
                      </span>
                      <span
                        className={cn(
                          "ml-auto shrink-0 tabular",
                          item.overBudget && "font-medium text-negative"
                        )}
                      >
                        {formatPercent(item.usage)} de {formatCurrency(item.budget)}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
