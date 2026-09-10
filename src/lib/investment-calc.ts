export type PeriodUnit = "anos" | "meses"
export type YieldMode = "cdi" | "aa" | "ipca"

export type CalculatorInput = {
  initial: number
  monthly: number
  period: number
  periodUnit: PeriodUnit
  selic: number
  cdi: number
  ipca: number
  tr: number
  prefixado: number
  custody: number
  ipcaPlus: number
  fundAdmin: number
  cdbYield: number
  cdbMode: YieldMode
  fundDi: number
  lciYield: number
  lciMode: YieldMode
  savings: number
}

export type ProductResult = {
  id: string
  name: string
  gross: number
  costs: number
  ir: number
  net: number
  invested: number
  gain: number
  grossReturn: number
  netReturn: number
  benchmark: boolean
}

export const CALCULATOR_DEFAULTS: CalculatorInput = {
  initial: 25000,
  monthly: 2500,
  period: 30,
  periodUnit: "anos",
  selic: 13.9,
  cdi: 13.9,
  ipca: 4.6,
  tr: 0.1708,
  prefixado: 14,
  custody: 0.2,
  ipcaPlus: 6.5,
  fundAdmin: 0.25,
  cdbYield: 100,
  cdbMode: "cdi",
  fundDi: 98.17,
  lciYield: 85,
  lciMode: "cdi",
  savings: 0.6717,
}

export function monthsInPeriod(period: number, unit: PeriodUnit) {
  const months = unit === "anos" ? period * 12 : period
  return Math.max(0, Math.round(months))
}

/** Monthly savings rate when Selic is above 8,5% a.a.: (1 + TR) × 0,5% a.m. */
export function savingsMonthlyFromRules(selicAnnual: number, trMonthly: number) {
  const tr = trMonthly / 100
  if (selicAnnual > 8.5) return (1 + tr) * 1.005 - 1
  const selicMonthly = Math.pow(1 + selicAnnual / 100, 1 / 12) - 1
  return tr + 0.7 * selicMonthly
}

export function formatRatePercent(value: number, digits = 4) {
  return `${(value * 100).toFixed(digits).replace(".", ",")}%`
}

function monthlyFactor(annualPercent: number) {
  return Math.pow(1 + annualPercent / 100, 1 / 12)
}

function lumpSum(initial: number, factor: number, months: number) {
  return initial * Math.pow(factor, months)
}

function annuity(monthly: number, monthlyPercent: number, months: number) {
  if (monthlyPercent === 0) return monthly * months
  const growth = Math.pow(1 + monthlyPercent / 100, months)
  return monthly * ((growth - 1) / (monthlyPercent / 100))
}

function annuityInterest(monthly: number, monthlyPercent: number, months: number) {
  return annuity(monthly, monthlyPercent, months) - monthly * months
}

function irPercent(months: number) {
  if (months <= 6) return 22.5
  if (months <= 11) return 20
  if (months <= 23) return 17.5
  return 15
}

function feeOnGross(gross: number, annualFeePercent: number, months: number) {
  const compounded = Math.pow(monthlyFactor(annualFeePercent), months) - 1
  return gross * compounded
}

function percentOf(value: number, percent: number) {
  return value * (percent / 100)
}

function returnPercent(finalValue: number, invested: number) {
  if (invested === 0) return 0
  return (finalValue / invested) * 100 - 100
}

function projectFixed(input: {
  id: string
  name: string
  initial: number
  monthly: number
  months: number
  annualPercent: number
  monthlyPercent?: number
  annualFee?: number
  taxFree?: boolean
  benchmark?: boolean
}): ProductResult {
  const monthlyPercent =
    input.monthlyPercent ?? (monthlyFactor(input.annualPercent) - 1) * 100
  const factor = 1 + monthlyPercent / 100
  const lump = lumpSum(input.initial, factor, input.months)
  const deposits = annuity(input.monthly, monthlyPercent, input.months)
  const gross = lump + deposits
  const profit =
    lump - input.initial + annuityInterest(input.monthly, monthlyPercent, input.months)
  const costs = input.annualFee ? feeOnGross(gross, input.annualFee, input.months) : 0
  const ir = input.taxFree ? 0 : percentOf(profit, irPercent(input.months))
  const invested = input.initial + input.monthly * input.months
  const net = gross - costs - ir

  return {
    id: input.id,
    name: input.name,
    gross,
    costs,
    ir,
    net,
    invested,
    gain: net - invested,
    grossReturn: returnPercent(gross, invested),
    netReturn: returnPercent(net, invested),
    benchmark: input.benchmark ?? false,
  }
}

function annualFromMode(
  yieldValue: number,
  mode: YieldMode,
  cdi: number,
  ipca: number
) {
  if (mode === "aa") return yieldValue
  if (mode === "ipca") return ipca + yieldValue
  return (cdi * yieldValue) / 100
}

export function simulateInvestments(input: CalculatorInput): ProductResult[] {
  const months = monthsInPeriod(input.period, input.periodUnit)
  const base = { initial: input.initial, monthly: input.monthly, months }
  const cdbAnnual = annualFromMode(input.cdbYield, input.cdbMode, input.cdi, input.ipca)
  const lciAnnual = annualFromMode(input.lciYield, input.lciMode, input.cdi, input.ipca)
  const fundAnnual = (input.cdi * input.fundDi) / 100

  const products = [
    projectFixed({
      ...base,
      id: "cdb",
      name: "CDB",
      annualPercent: cdbAnnual,
    }),
    projectFixed({
      ...base,
      id: "prefixado",
      name: "Tesouro Prefixado",
      annualPercent: input.prefixado,
      annualFee: input.custody,
    }),
    projectFixed({
      ...base,
      id: "selic",
      name: "Tesouro Selic",
      annualPercent: input.selic,
      annualFee: input.custody,
    }),
    projectFixed({
      ...base,
      id: "fundo",
      name: "Fundo DI",
      annualPercent: fundAnnual,
      annualFee: input.fundAdmin,
    }),
    projectFixed({
      ...base,
      id: "lci",
      name: "LCI e LCA",
      annualPercent: lciAnnual,
      taxFree: true,
    }),
    projectFixed({
      ...base,
      id: "ipca-plus",
      name: "Tesouro IPCA+",
      annualPercent: input.ipca + input.ipcaPlus,
      annualFee: input.custody,
    }),
    projectFixed({
      ...base,
      id: "poupanca",
      name: "Poupança",
      annualPercent: 0,
      monthlyPercent: input.savings,
      taxFree: true,
    }),
    projectFixed({
      ...base,
      id: "ipca",
      name: "Correção pelo IPCA",
      annualPercent: input.ipca,
      taxFree: true,
      benchmark: true,
    }),
  ]

  const ranked = products
    .filter((item) => !item.benchmark)
    .sort((a, b) => b.net - a.net)
  const benchmark = products.find((item) => item.benchmark)
  return benchmark ? [...ranked, benchmark] : ranked
}

export function totalInvested(input: CalculatorInput) {
  const months = monthsInPeriod(input.period, input.periodUnit)
  return input.initial + input.monthly * months
}
