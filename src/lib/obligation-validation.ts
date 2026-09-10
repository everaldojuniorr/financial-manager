import { isSegmentId } from "./segments"
import type { ObligationKind, SegmentId } from "./types"

const COMPETENCE = /^\d{4}-\d{2}$/

const KINDS = new Set<ObligationKind>(["fixa", "variavel", "emprestimo"])

function asObject(raw: unknown) {
  if (typeof raw !== "object" || raw === null) return null
  return raw as Record<string, unknown>
}

export function parseObligationInput(raw: unknown) {
  const errors: string[] = []
  const body = asObject(raw)
  if (!body) return { ok: false as const, errors: ["Corpo da requisição inválido."] }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  const kind = body.kind
  const segment = typeof body.segment === "string" ? body.segment : ""

  if (name.length < 2) errors.push("Informe um nome com pelo menos 2 caracteres.")
  if (!KINDS.has(kind as ObligationKind)) {
    errors.push("Tipo de dívida inválido.")
  }
  if (!isSegmentId(segment)) errors.push("Escolha um segmento.")
  if (errors.length) return { ok: false as const, errors }

  return {
    ok: true as const,
    value: {
      name,
      kind: kind as ObligationKind,
      segment: segment as SegmentId,
    },
  }
}

export function parseObligationPatch(raw: unknown) {
  const errors: string[] = []
  const body = asObject(raw)
  if (!body) return { ok: false as const, errors: ["Corpo da requisição inválido."] }

  const value: { name?: string; segment?: SegmentId; active?: boolean } = {}
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (name.length < 2) errors.push("Informe um nome com pelo menos 2 caracteres.")
    else value.name = name
  }
  if (body.segment !== undefined) {
    if (typeof body.segment !== "string" || !isSegmentId(body.segment)) {
      errors.push("Escolha um segmento.")
    } else value.segment = body.segment
  }
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") errors.push("Status inválido.")
    else value.active = body.active
  }
  if (errors.length) return { ok: false as const, errors }
  return { ok: true as const, value }
}

export function parseObligationEntryInput(raw: unknown) {
  const errors: string[] = []
  const body = asObject(raw)
  if (!body) return { ok: false as const, errors: ["Corpo da requisição inválido."] }

  const competence = typeof body.competence === "string" ? body.competence : ""
  if (!COMPETENCE.test(competence)) errors.push("Competência inválida (use AAAA-MM).")

  let amount: number | null = null
  if (body.amount === null || body.amount === "") {
    amount = null
  } else {
    const parsed = Number(body.amount)
    if (!Number.isFinite(parsed) || parsed < 0) {
      errors.push("O valor precisa ser zero ou maior, ou ficar em branco.")
    } else if (parsed === 0) {
      amount = null
    } else {
      amount = Math.round(parsed * 100) / 100
    }
  }

  const paid = body.paid === true
  if (errors.length) return { ok: false as const, errors }
  return { ok: true as const, value: { competence, amount, paid } }
}

export function parseCopyObligationsInput(raw: unknown) {
  const errors: string[] = []
  const body = asObject(raw)
  if (!body) return { ok: false as const, errors: ["Corpo da requisição inválido."] }

  const kind = body.kind
  const competence = typeof body.competence === "string" ? body.competence : ""
  if (kind !== "fixa" && kind !== "emprestimo") {
    errors.push("Só dá para copiar o mês anterior em dívidas fixas e empréstimos.")
  }
  if (!COMPETENCE.test(competence)) errors.push("Competência inválida (use AAAA-MM).")
  if (errors.length) return { ok: false as const, errors }
  return {
    ok: true as const,
    value: { kind: kind as "fixa" | "emprestimo", competence },
  }
}
