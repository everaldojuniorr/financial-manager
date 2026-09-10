"use client"

import * as React from "react"
import {
  Banknote,
  CreditCard,
  Droplets,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Settings,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { PERIOD_OPTIONS, type PeriodId } from "@/lib/finance"
import { cn } from "@/lib/utils"

export type AppSection =
  | "inicio"
  | "cartoes"
  | "emprestimos"
  | "dividas-fixas"
  | "dividas-variaveis"
  | "investimentos"
  | "configuracoes"

const NAV: { id: AppSection; label: string; icon: LucideIcon }[] = [
  { id: "inicio", label: "Início", icon: LayoutDashboard },
  { id: "cartoes", label: "Cartões", icon: CreditCard },
  { id: "emprestimos", label: "Empréstimos", icon: Banknote },
  { id: "dividas-fixas", label: "Dívidas fixas", icon: Wallet },
  { id: "dividas-variaveis", label: "Dívidas variáveis", icon: Droplets },
  { id: "investimentos", label: "Investimentos", icon: TrendingUp },
]

function Brand({ todayLabel }: { todayLabel?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Wallet className="size-4" />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate font-heading text-sm font-semibold">Controle Financeiro</p>
        {todayLabel ? (
          <p className="truncate text-xs text-muted-foreground">Atualizado em {todayLabel}</p>
        ) : null}
      </div>
    </div>
  )
}

function NavList({
  section,
  onSelect,
}: {
  section: AppSection
  onSelect: (section: AppSection) => void
}) {
  return (
    <ul className="space-y-1">
      {NAV.map((item) => {
        const Icon = item.icon
        const active = section === item.id
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function AppShell({
  children,
  section,
  onSectionChange,
  periodId,
  onPeriodChange,
  todayLabel,
  onRefresh,
  refreshing,
  disabled = false,
}: {
  children: React.ReactNode
  section: AppSection
  onSectionChange: (section: AppSection) => void
  periodId: PeriodId
  onPeriodChange: (id: PeriodId) => void
  todayLabel?: string
  onRefresh?: () => void
  refreshing?: boolean
  disabled?: boolean
}) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const settingsActive = section === "configuracoes"

  function selectSection(next: AppSection) {
    onSectionChange(next)
    setMenuOpen(false)
  }

  return (
    <div className="flex min-h-dvh">
      <aside
        className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r bg-background md:flex"
        aria-label="Seções"
      >
        <div className="flex h-16 items-center px-4">
          <Brand todayLabel={todayLabel} />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <NavList section={section} onSelect={selectSection} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <Button
                variant="outline"
                size="icon"
                className="md:hidden"
                aria-label="Abrir menu"
                onClick={() => setMenuOpen(true)}
              >
                <Menu />
              </Button>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="h-16 justify-center border-b px-4">
                  <SheetTitle className="sr-only">Menu</SheetTitle>
                  <SheetDescription className="sr-only">
                    Seções do controle financeiro
                  </SheetDescription>
                  <Brand todayLabel={todayLabel} />
                </SheetHeader>
                <nav className="px-3 py-3" aria-label="Seções">
                  <NavList section={section} onSelect={selectSection} />
                </nav>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1 md:hidden">
              <Brand />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant={settingsActive ? "secondary" : "outline"}
                onClick={() => onSectionChange("configuracoes")}
                aria-current={settingsActive ? "page" : undefined}
              >
                <Settings />
                <span className="hidden sm:inline">Configurações</span>
              </Button>

              <Select
                value={periodId}
                onValueChange={(value) => onPeriodChange(value as PeriodId)}
                disabled={disabled}
              >
                <SelectTrigger className="w-36 sm:w-40" aria-label="Selecionar período">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {onRefresh && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onRefresh}
                  disabled={refreshing}
                  aria-label="Recarregar lançamentos"
                >
                  <RefreshCw className={refreshing ? "animate-spin" : undefined} />
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  )
}
