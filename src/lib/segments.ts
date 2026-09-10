import type { ObligationKind, SegmentId } from "./types"

export type Segment = {
  id: SegmentId
  name: string
  color: string
}

export const SEGMENTS: Segment[] = [
  { id: "moradia", name: "Moradia", color: "oklch(0.62 0.14 258)" },
  { id: "transporte", name: "Transporte", color: "oklch(0.65 0.13 195)" },
  { id: "saude", name: "Saúde", color: "oklch(0.66 0.14 350)" },
  { id: "emprestimos", name: "Empréstimos", color: "oklch(0.62 0.13 145)" },
  { id: "imprevistos", name: "Imprevistos", color: "oklch(0.72 0.16 85)" },
  { id: "cartao", name: "Cartão", color: "oklch(0.64 0.15 15)" },
]

export const SEGMENT_MAP = new Map(SEGMENTS.map((segment) => [segment.id, segment]))

export function getSegment(id: string): Segment {
  return (
    SEGMENT_MAP.get(id as SegmentId) ?? {
      id: "imprevistos",
      name: "Imprevistos",
      color: "oklch(0.6 0 0)",
    }
  )
}

export function isSegmentId(value: string): value is SegmentId {
  return SEGMENT_MAP.has(value as SegmentId)
}

export const DEFAULT_OBLIGATIONS: {
  name: string
  kind: ObligationKind
  segment: SegmentId
}[] = [
  { name: "Carro", kind: "fixa", segment: "transporte" },
  { name: "Seguro do carro", kind: "fixa", segment: "transporte" },
  { name: "Seguro de vida", kind: "fixa", segment: "saude" },
  { name: "Seguro residencial", kind: "fixa", segment: "moradia" },
  { name: "Aluguel", kind: "fixa", segment: "moradia" },
  { name: "Evolução de obra apto", kind: "fixa", segment: "moradia" },
  { name: "Plano de saúde", kind: "fixa", segment: "saude" },
  { name: "IPTU", kind: "fixa", segment: "moradia" },
  { name: "Condomínio apto", kind: "fixa", segment: "moradia" },
  { name: "Conta de luz", kind: "variavel", segment: "moradia" },
  { name: "Conta de água", kind: "variavel", segment: "moradia" },
  { name: "Pedágio", kind: "variavel", segment: "transporte" },
  { name: "Imprevistos", kind: "variavel", segment: "imprevistos" },
]

export function defaultSegmentForKind(kind: ObligationKind): SegmentId {
  if (kind === "emprestimo") return "emprestimos"
  if (kind === "variavel") return "imprevistos"
  return "moradia"
}
