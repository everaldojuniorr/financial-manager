import { AlertTriangle, Inbox, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function Shimmer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-foreground/8", className)}
      aria-hidden
      {...props}
    />
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Carregando painel financeiro">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3">
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-7 w-32" />
              <Shimmer className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4">
              <Shimmer className="h-3 w-40" />
              <div className="flex h-56 items-end gap-1.5">
                {Array.from({ length: 24 }).map((_, index) => (
                  <Shimmer
                    key={index}
                    className="flex-1"
                    // Static staircase keeps the skeleton from flickering between renders.
                    style={{ height: `${30 + ((index * 37) % 60)}%` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <Shimmer key={index} className="h-9 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3">
              <Shimmer className="h-3 w-32" />
              <Shimmer className="h-24 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Shimmer key={index} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <Card className="border-destructive/30">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-heading text-base font-medium">
            Não foi possível carregar seus lançamentos
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
        </div>
        <Button onClick={onRetry} variant="outline" size="sm">
          <RotateCw />
          Tentar novamente
        </Button>
      </CardContent>
    </Card>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="font-heading text-sm font-medium">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}
