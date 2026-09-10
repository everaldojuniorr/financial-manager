import { toISODate } from "./format"
import type { PaymentMethod, Transaction } from "./types"

/** Seeded PRNG so the demo ledger is identical on every boot and every machine. */
function mulberry32(seed: number) {
  let state = seed
  return function random() {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type MonthlyTemplate = {
  day: number
  categoryId: string
  description: string
  amount: number
  method: PaymentMethod
  tag: string
  type: "entrada" | "saida"
  note?: string
}

const MONTHLY: MonthlyTemplate[] = [
  {
    day: 5,
    categoryId: "salario",
    description: "Salário Vertex Tecnologia",
    amount: 8420,
    method: "transferencia",
    tag: "clt",
    type: "entrada",
    note: "Líquido após INSS e IR",
  },
  {
    day: 10,
    categoryId: "moradia",
    description: "Aluguel do apartamento",
    amount: 1980,
    method: "boleto",
    tag: "fixo",
    type: "saida",
  },
  {
    day: 10,
    categoryId: "moradia",
    description: "Condomínio",
    amount: 465,
    method: "boleto",
    tag: "fixo",
    type: "saida",
  },
  {
    day: 14,
    categoryId: "moradia",
    description: "Energia elétrica",
    amount: 187.4,
    method: "debito",
    tag: "utilidades",
    type: "saida",
  },
  {
    day: 16,
    categoryId: "moradia",
    description: "Internet fibra 600MB",
    amount: 119.9,
    method: "credito",
    tag: "utilidades",
    type: "saida",
  },
  {
    day: 8,
    categoryId: "saude",
    description: "Plano de saúde Unimed",
    amount: 412.7,
    method: "boleto",
    tag: "fixo",
    type: "saida",
  },
  {
    day: 3,
    categoryId: "assinaturas",
    description: "Spotify Família",
    amount: 34.9,
    method: "credito",
    tag: "streaming",
    type: "saida",
  },
  {
    day: 6,
    categoryId: "assinaturas",
    description: "Netflix Premium",
    amount: 59.9,
    method: "credito",
    tag: "streaming",
    type: "saida",
  },
  {
    day: 12,
    categoryId: "assinaturas",
    description: "iCloud 2TB",
    amount: 49.9,
    method: "credito",
    tag: "nuvem",
    type: "saida",
  },
  {
    day: 20,
    categoryId: "assinaturas",
    description: "GitHub Copilot",
    amount: 54.2,
    method: "credito",
    tag: "trabalho",
    type: "saida",
  },
  {
    day: 15,
    categoryId: "educacao",
    description: "Mensalidade pós-graduação",
    amount: 349,
    method: "boleto",
    tag: "curso",
    type: "saida",
  },
  {
    day: 22,
    categoryId: "taxas",
    description: "Tarifa de manutenção da conta",
    amount: 32,
    method: "debito",
    tag: "banco",
    type: "saida",
  },
  {
    day: 5,
    categoryId: "aportes",
    description: "Aporte mensal Tesouro Selic",
    amount: 500,
    method: "transferencia",
    tag: "renda-fixa",
    type: "saida",
  },
  {
    day: 25,
    categoryId: "rendimentos",
    description: "Rendimento CDB liquidez diária",
    amount: 214.35,
    method: "transferencia",
    tag: "renda-fixa",
    type: "entrada",
  },
  {
    day: 28,
    categoryId: "transporte",
    description: "Seguro do carro",
    amount: 168.5,
    method: "credito",
    tag: "fixo",
    type: "saida",
  },
]

type DailyTemplate = {
  categoryId: string
  descriptions: string[]
  min: number
  max: number
  methods: PaymentMethod[]
  tag: string
  /** Rough chance the entry shows up on any given day. */
  chance: number
}

const DAILY: DailyTemplate[] = [
  {
    categoryId: "alimentacao",
    descriptions: [
      "Padaria da esquina",
      "Café expresso",
      "Almoço no self-service",
      "Marmita fitness",
      "Lanche da tarde",
    ],
    min: 9,
    max: 38,
    methods: ["pix", "debito", "dinheiro"],
    tag: "dia-a-dia",
    chance: 0.72,
  },
  {
    categoryId: "alimentacao",
    descriptions: [
      "Mercado Pão de Açúcar",
      "Hortifruti da feira",
      "Açougue do bairro",
      "Compra do mês no atacado",
    ],
    min: 72,
    max: 290,
    methods: ["credito", "debito"],
    tag: "mercado",
    chance: 0.11,
  },
  {
    categoryId: "alimentacao",
    descriptions: ["iFood — jantar", "Rappi — sushi", "Delivery pizza"],
    min: 34,
    max: 105,
    methods: ["credito", "pix"],
    tag: "delivery",
    chance: 0.14,
  },
  {
    categoryId: "transporte",
    descriptions: ["Uber para o escritório", "99 para casa", "Metrô — recarga"],
    min: 8,
    max: 48,
    methods: ["credito", "pix", "debito"],
    tag: "deslocamento",
    chance: 0.4,
  },
  {
    categoryId: "transporte",
    descriptions: ["Gasolina Shell", "Etanol Ipiranga", "Estacionamento rotativo"],
    min: 24,
    max: 210,
    methods: ["credito", "debito"],
    tag: "carro",
    chance: 0.08,
  },
  {
    categoryId: "lazer",
    descriptions: [
      "Cerveja com o pessoal",
      "Cinema — sessão da noite",
      "Show no Teatro Rival",
      "Trilha no parque — taxa",
    ],
    min: 20,
    max: 135,
    methods: ["credito", "pix", "dinheiro"],
    tag: "social",
    chance: 0.17,
  },
  {
    categoryId: "compras",
    descriptions: [
      "Camiseta básica",
      "Fone de ouvido bluetooth",
      "Itens de casa — Mobly",
      "Livro na Amazon",
    ],
    min: 32,
    max: 300,
    methods: ["credito"],
    tag: "varejo",
    chance: 0.09,
  },
  {
    categoryId: "saude",
    descriptions: ["Farmácia — medicamentos", "Consulta dermatologista", "Exame de sangue"],
    min: 26,
    max: 170,
    methods: ["credito", "pix", "debito"],
    tag: "cuidados",
    chance: 0.07,
  },
  {
    categoryId: "educacao",
    descriptions: ["Curso avulso Udemy", "eBook técnico", "Workshop de produto"],
    min: 27,
    max: 180,
    methods: ["credito"],
    tag: "estudo",
    chance: 0.04,
  },
  {
    categoryId: "freelance",
    descriptions: [
      "Freela — landing page",
      "Consultoria de dados",
      "Manutenção de site cliente",
    ],
    min: 480,
    max: 2400,
    methods: ["pix", "transferencia"],
    tag: "extra",
    chance: 0.022,
  },
  {
    categoryId: "reembolsos",
    descriptions: ["Reembolso de viagem corporativa", "Estorno de compra", "Racha do jantar"],
    min: 35,
    max: 420,
    methods: ["pix"],
    tag: "estorno",
    chance: 0.05,
  },
]

/** Covers the longest window (90 days) plus its comparison window, with margin. */
const DAYS_OF_HISTORY = 210

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function pick<T>(random: () => number, items: T[]): T {
  return items[Math.floor(random() * items.length)]
}

/** Builds a realistic ledger ending on `today`, mixing fixed monthly bills with daily noise. */
export function buildLedger(today: Date = new Date()): Transaction[] {
  const random = mulberry32(20260910)
  const transactions: Transaction[] = []
  let counter = 0

  const nextId = () => `tx_${(++counter).toString().padStart(4, "0")}`

  const start = new Date(today)
  start.setDate(start.getDate() - DAYS_OF_HISTORY)

  for (let offset = 0; offset <= DAYS_OF_HISTORY; offset++) {
    const current = new Date(start)
    current.setDate(start.getDate() + offset)
    const iso = toISODate(current)
    const dayOfMonth = current.getDate()
    const weekday = current.getDay()

    for (const template of MONTHLY) {
      if (template.day !== dayOfMonth) continue
      // Bills drift a little month to month, the way real invoices do.
      const drift = template.tag === "fixo" ? 1 : 0.92 + random() * 0.18
      transactions.push({
        id: nextId(),
        date: iso,
        description: template.description,
        categoryId: template.categoryId,
        method: template.method,
        amount: round2(template.amount * drift),
        type: template.type,
        tag: template.tag,
        note: template.note ?? "",
        recurring: true,
      })
    }

    for (const template of DAILY) {
      // Weekends push leisure and delivery up, commuting down.
      const isWeekend = weekday === 0 || weekday === 6
      let chance = template.chance
      if (isWeekend && (template.tag === "social" || template.tag === "delivery")) {
        chance *= 1.9
      }
      if (isWeekend && template.tag === "deslocamento") chance *= 0.4

      if (random() > chance) continue

      transactions.push({
        id: nextId(),
        date: iso,
        description: pick(random, template.descriptions),
        categoryId: template.categoryId,
        method: pick(random, template.methods),
        amount: round2(template.min + random() * (template.max - template.min)),
        type: template.categoryId === "freelance" || template.categoryId === "reembolsos"
          ? "entrada"
          : "saida",
        tag: template.tag,
        note: "",
        recurring: false,
      })
    }
  }

  return transactions.sort((a, b) =>
    a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)
  )
}
