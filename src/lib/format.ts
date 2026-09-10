const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

const currencyNoSymbol = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const compact = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
})

export function formatCurrency(value: number) {
  return currency.format(value)
}

export function formatAmount(value: number) {
  return currencyNoSymbol.format(value)
}

export function formatCompact(value: number) {
  if (Math.abs(value) < 1000) return currencyNoSymbol.format(Math.round(value))
  return compact.format(value)
}

export function formatSigned(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : ""
  return `${sign}${currency.format(Math.abs(value))}`
}

export function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits).replace(".", ",")}%`
}

/** Parses `yyyy-mm-dd` in local time; `new Date(iso)` would shift the day by the UTC offset. */
export function parseDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function toISODate(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

const dayMonth = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
})

const fullDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

const weekdayShort = new Intl.DateTimeFormat("pt-BR", { weekday: "short" })

const monthYear = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
})

export function formatDayMonth(iso: string) {
  return dayMonth.format(parseDate(iso))
}

export function formatFullDate(iso: string) {
  return fullDate.format(parseDate(iso)).replace(".", "")
}

export function formatWeekday(iso: string) {
  return weekdayShort.format(parseDate(iso)).replace(".", "")
}

export function formatMonthYear(iso: string) {
  const label = monthYear.format(parseDate(iso))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Formats `YYYY-MM` competence labels for invoices. */
export function formatCompetence(competence: string) {
  const [year, month] = competence.split("-").map(Number)
  const label = monthYear.format(new Date(year, month - 1, 1))
  return label.charAt(0).toUpperCase() + label.slice(1).replace(".", "")
}

export function formatInstallment(current: number, total: number) {
  return total <= 1 ? "à vista" : `${current}/${total}`
}

export function addMonthsToCompetence(competence: string, months: number) {
  const [year, month] = competence.split("-").map(Number)
  const date = new Date(year, month - 1 + months, 1)
  const nextMonth = `${date.getMonth() + 1}`.padStart(2, "0")
  return `${date.getFullYear()}-${nextMonth}`
}

/** Shifts a calendar date by whole months, clamping the day to the target month. */
export function addMonthsToDate(iso: string, months: number) {
  const date = parseDate(iso)
  const day = date.getDate()
  const shifted = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const last = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate()
  shifted.setDate(Math.min(day, last))
  return toISODate(shifted)
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export function relativeDay(iso: string, today: string) {
  const diff = Math.round(
    (parseDate(today).getTime() - parseDate(iso).getTime()) / 86_400_000
  )
  if (diff === 0) return "Hoje"
  if (diff === 1) return "Ontem"
  if (diff > 1 && diff < 7) return `${diff} dias atrás`
  return formatFullDate(iso)
}
