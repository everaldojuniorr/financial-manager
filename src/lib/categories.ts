import type { Category } from "./types"

export const CATEGORIES: Category[] = [
  {
    id: "moradia",
    name: "Moradia",
    kind: "essencial",
    type: "saida",
    color: "oklch(0.62 0.14 258)",
    monthlyBudget: 2900,
  },
  {
    id: "alimentacao",
    name: "Alimentação",
    kind: "essencial",
    type: "saida",
    color: "oklch(0.68 0.15 45)",
    monthlyBudget: 1780,
  },
  {
    id: "transporte",
    name: "Transporte",
    kind: "essencial",
    type: "saida",
    color: "oklch(0.65 0.13 195)",
    monthlyBudget: 880,
  },
  {
    id: "saude",
    name: "Saúde",
    kind: "essencial",
    type: "saida",
    color: "oklch(0.66 0.14 350)",
    monthlyBudget: 720,
  },
  {
    id: "assinaturas",
    name: "Assinaturas",
    kind: "variavel",
    type: "saida",
    color: "oklch(0.63 0.16 295)",
    monthlyBudget: 220,
  },
  {
    id: "lazer",
    name: "Lazer",
    kind: "variavel",
    type: "saida",
    color: "oklch(0.72 0.16 85)",
    monthlyBudget: 520,
  },
  {
    id: "compras",
    name: "Compras",
    kind: "variavel",
    type: "saida",
    color: "oklch(0.64 0.15 15)",
    monthlyBudget: 430,
  },
  {
    id: "educacao",
    name: "Educação",
    kind: "investimento",
    type: "saida",
    color: "oklch(0.62 0.13 145)",
    monthlyBudget: 620,
  },
  {
    id: "taxas",
    name: "Taxas e impostos",
    kind: "essencial",
    type: "saida",
    color: "oklch(0.58 0.06 250)",
    monthlyBudget: 45,
  },
  {
    id: "salario",
    name: "Salário",
    kind: "receita",
    type: "entrada",
    color: "oklch(0.63 0.15 155)",
    monthlyBudget: 0,
  },
  {
    id: "freelance",
    name: "Freelance",
    kind: "receita",
    type: "entrada",
    color: "oklch(0.68 0.14 170)",
    monthlyBudget: 0,
  },
  {
    id: "rendimentos",
    name: "Rendimentos",
    kind: "receita",
    type: "entrada",
    color: "oklch(0.72 0.12 140)",
    monthlyBudget: 0,
  },
  {
    id: "reembolsos",
    name: "Reembolsos",
    kind: "receita",
    type: "entrada",
    color: "oklch(0.7 0.1 185)",
    monthlyBudget: 0,
  },
]

export const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.id, c]))

export function getCategory(id: string): Category {
  return (
    CATEGORY_MAP.get(id) ?? {
      id,
      name: "Sem categoria",
      kind: "variavel",
      type: "saida",
      color: "oklch(0.6 0 0)",
      monthlyBudget: 0,
    }
  )
}

export const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c.type === "saida")
export const INCOME_CATEGORIES = CATEGORIES.filter((c) => c.type === "entrada")

export const TOTAL_MONTHLY_BUDGET = EXPENSE_CATEGORIES.reduce(
  (sum, c) => sum + c.monthlyBudget,
  0
)
