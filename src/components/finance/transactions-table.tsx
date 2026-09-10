"use client"

import * as React from "react"
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Copy,
  MoreHorizontal,
  Repeat,
  Search,
  Trash2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/finance/states"
import { CATEGORIES, getCategory } from "@/lib/categories"
import { formatCurrency, formatDayMonth, relativeDay } from "@/lib/format"
import { PAYMENT_METHODS } from "@/lib/types"
import type { Transaction } from "@/lib/types"
import { cn } from "@/lib/utils"

export type SortKey = "date" | "amount" | "description"
export type SortDirection = "asc" | "desc"

export type TableFilters = {
  search: string
  type: "todos" | "entrada" | "saida"
  category: string
  method: string
}

const METHOD_LABEL = new Map(PAYMENT_METHODS.map((m) => [m.id, m.label]))

const PAGE_SIZE = 25

export function applyFilters(
  transactions: Transaction[],
  filters: TableFilters
): Transaction[] {
  const term = filters.search.trim().toLowerCase()

  return transactions.filter((transaction) => {
    if (filters.type !== "todos" && transaction.type !== filters.type) return false
    if (filters.category !== "todas" && transaction.categoryId !== filters.category) {
      return false
    }
    if (filters.method !== "todos" && transaction.method !== filters.method) return false
    if (!term) return true

    const haystack = [
      transaction.description,
      transaction.tag,
      transaction.note,
      getCategory(transaction.categoryId).name,
    ]
      .join(" ")
      .toLowerCase()

    return haystack.includes(term)
  })
}

export function sortTransactions(
  transactions: Transaction[],
  key: SortKey,
  direction: SortDirection
): Transaction[] {
  const factor = direction === "asc" ? 1 : -1
  return [...transactions].sort((a, b) => {
    if (key === "amount") return (a.amount - b.amount) * factor
    if (key === "description") return a.description.localeCompare(b.description) * factor
    if (a.date === b.date) return a.id.localeCompare(b.id) * factor
    return a.date.localeCompare(b.date) * factor
  })
}

function SortButton({
  label,
  column,
  sortKey,
  direction,
  onSort,
  align = "left",
}: {
  label: string
  column: SortKey
  sortKey: SortKey
  direction: SortDirection
  onSort: (key: SortKey) => void
  align?: "left" | "right"
}) {
  const active = sortKey === column
  const Icon = !active ? ChevronsUpDown : direction === "asc" ? ArrowUp : ArrowDown

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 rounded transition-colors hover:text-foreground",
        active && "text-foreground",
        align === "right" && "flex-row-reverse"
      )}
    >
      {label}
      <Icon className={cn("size-3", !active && "opacity-40")} />
    </button>
  )
}

export function TransactionsTable({
  transactions,
  filters,
  onFiltersChange,
  sortKey,
  direction,
  onSortChange,
  onDuplicate,
  onDelete,
  today,
}: {
  transactions: Transaction[]
  filters: TableFilters
  onFiltersChange: (filters: TableFilters) => void
  sortKey: SortKey
  direction: SortDirection
  onSortChange: (key: SortKey, direction: SortDirection) => void
  onDuplicate: (transaction: Transaction) => void
  onDelete: (transaction: Transaction) => void
  today: string
}) {
  const [visible, setVisible] = React.useState(PAGE_SIZE)

  const filtered = React.useMemo(
    () => sortTransactions(applyFilters(transactions, filters), sortKey, direction),
    [transactions, filters, sortKey, direction]
  )

  // Changing what the list shows should send you back to the top of it.
  const viewKey = [
    filters.search,
    filters.type,
    filters.category,
    filters.method,
    sortKey,
    direction,
  ].join("|")
  const [lastViewKey, setLastViewKey] = React.useState(viewKey)
  if (lastViewKey !== viewKey) {
    setLastViewKey(viewKey)
    setVisible(PAGE_SIZE)
  }

  const totals = React.useMemo(
    () =>
      filtered.reduce(
        (acc, transaction) => {
          if (transaction.type === "entrada") acc.income += transaction.amount
          else acc.expense += transaction.amount
          return acc
        },
        { income: 0, expense: 0 }
      ),
    [filtered]
  )

  const rows = filtered.slice(0, visible)
  const hasFilters =
    filters.search !== "" ||
    filters.type !== "todos" ||
    filters.category !== "todas" ||
    filters.method !== "todos"

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      onSortChange(key, direction === "asc" ? "desc" : "asc")
    } else {
      onSortChange(key, key === "description" ? "asc" : "desc")
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Lançamentos</CardTitle>
        <CardDescription>
          <span className="tabular">{filtered.length}</span> registros ·{" "}
          <span className="font-medium text-positive tabular">
            {formatCurrency(totals.income)}
          </span>{" "}
          em entradas ·{" "}
          <span className="font-medium text-negative tabular">
            {formatCurrency(totals.expense)}
          </span>{" "}
          em saídas
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(event) =>
                onFiltersChange({ ...filters, search: event.target.value })
              }
              placeholder="Buscar por descrição, etiqueta ou categoria"
              className="pl-8"
              aria-label="Buscar lançamentos"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 lg:flex">
            <Select
              value={filters.type}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, type: value as TableFilters["type"] })
              }
            >
              <SelectTrigger className="lg:w-32" aria-label="Filtrar por tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Tipo: todos</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="saida">Saídas</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.category}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, category: value })
              }
            >
              <SelectTrigger className="lg:w-40" aria-label="Filtrar por categoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {CATEGORIES.map((category) => (
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

            <Select
              value={filters.method}
              onValueChange={(value) => onFiltersChange({ ...filters, method: value })}
            >
              <SelectTrigger className="lg:w-36" aria-label="Filtrar por método">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os métodos</SelectItem>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.id} value={method.id}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title={
              hasFilters
                ? "Nenhum lançamento com esses filtros"
                : "Nenhum lançamento no período"
            }
            description={
              hasFilters
                ? "Ajuste a busca ou limpe os filtros para ver mais resultados."
                : "Registre a primeira entrada ou saída para começar o acompanhamento."
            }
            action={
              hasFilters ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onFiltersChange({
                      search: "",
                      type: "todos",
                      category: "todas",
                      method: "todos",
                    })
                  }
                >
                  Limpar filtros
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="-mx-(--card-spacing) overflow-x-auto">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28 pl-(--card-spacing)">
                      <SortButton
                        label="Data"
                        column="date"
                        sortKey={sortKey}
                        direction={direction}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortButton
                        label="Descrição"
                        column="description"
                        sortKey={sortKey}
                        direction={direction}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="w-40">Categoria</TableHead>
                    <TableHead className="w-32">Método</TableHead>
                    <TableHead className="w-32 text-right">
                      <SortButton
                        label="Valor"
                        column="amount"
                        sortKey={sortKey}
                        direction={direction}
                        onSort={handleSort}
                        align="right"
                      />
                    </TableHead>
                    <TableHead className="w-10 pr-(--card-spacing)" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {rows.map((transaction) => {
                    const category = getCategory(transaction.categoryId)
                    const isIncome = transaction.type === "entrada"
                    return (
                      <TableRow key={transaction.id} className="group/row">
                        <TableCell className="pl-(--card-spacing) align-top">
                          <span className="block text-sm tabular">
                            {formatDayMonth(transaction.date)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {relativeDay(transaction.date, today)}
                          </span>
                        </TableCell>

                        <TableCell className="align-top">
                          <span className="flex items-center gap-1.5 font-medium">
                            <span className="truncate">{transaction.description}</span>
                            {transaction.createdBy ? (
                              <span className="shrink-0 text-xs font-normal text-muted-foreground">
                                · {transaction.createdBy}
                              </span>
                            ) : null}
                            {transaction.invoiceId && (
                              <Badge variant="secondary" className="font-normal">
                                Fatura
                              </Badge>
                            )}
                            {transaction.recurring && (
                              <Repeat
                                className="size-3 shrink-0 text-muted-foreground"
                                aria-label="Lançamento recorrente"
                              />
                            )}
                          </span>
                          {(transaction.tag || transaction.note) && (
                            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              {transaction.tag && (
                                <Badge variant="outline" className="font-normal">
                                  #{transaction.tag}
                                </Badge>
                              )}
                              {transaction.note && (
                                <span className="truncate">{transaction.note}</span>
                              )}
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="align-top">
                          <span className="flex items-center gap-1.5 text-sm">
                            <span
                              className="size-2 shrink-0 rounded-[3px]"
                              style={{ backgroundColor: category.color }}
                            />
                            <span className="truncate">{category.name}</span>
                          </span>
                        </TableCell>

                        <TableCell className="align-top text-sm text-muted-foreground">
                          {METHOD_LABEL.get(transaction.method) ?? transaction.method}
                        </TableCell>

                        <TableCell
                          className={cn(
                            "align-top text-right font-medium tabular",
                            isIncome ? "text-positive" : "text-foreground"
                          )}
                        >
                          {isIncome ? "+" : "−"}
                          {formatCurrency(transaction.amount)}
                        </TableCell>

                        <TableCell className="pr-(--card-spacing) align-top">
                          {!transaction.invoiceId && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
                                aria-label={`Ações para ${transaction.description}`}
                              >
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => onDuplicate(transaction)}
                              >
                                <Copy />
                                Duplicar para hoje
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => onDelete(transaction)}
                              >
                                <Trash2 />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {visible < filtered.length && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setVisible((current) => current + PAGE_SIZE)}
              >
                Mostrar mais {Math.min(PAGE_SIZE, filtered.length - visible)} de{" "}
                {filtered.length - visible} restantes
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
