import { and, asc, eq, sql } from "drizzle-orm"
import type { AnyColumn } from "drizzle-orm"

import { getDb } from "@/db/client"
import { obligationEntries, obligations } from "@/db/schema"
import { householdUserIds, memberFilter } from "./household"
import { addMonthsToCompetence } from "./format"
import { DEFAULT_OBLIGATIONS } from "./segments"
import type {
  Obligation,
  ObligationEntry,
  ObligationKind,
  SegmentId,
} from "./types"

async function inHousehold(userId: string, column: AnyColumn) {
  return memberFilter(column, await householdUserIds(userId))
}

function mapObligation(row: typeof obligations.$inferSelect): Obligation {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as ObligationKind,
    segment: row.segment as SegmentId,
    active: row.active,
    sortOrder: row.sortOrder,
  }
}

function obligationKey(kind: string, name: string) {
  return `${kind}:${name.trim().toLocaleLowerCase("pt-BR")}`
}

function mergeAmounts(left: number | null, right: number | null): number | null {
  if (left == null && right == null) return null
  return (left ?? 0) + (right ?? 0)
}

/** Junta dívidas fixas e variáveis com o mesmo nome, vindas das duas contas da casa. */
export async function mergeDuplicateObligations(userId: string) {
  const db = getDb()
  const rows = await db
    .select()
    .from(obligations)
    .where(await inHousehold(userId, obligations.userId))

  const groups = new Map<string, (typeof rows)[number][]>()
  for (const row of rows) {
    if (row.kind !== "fixa" && row.kind !== "variavel") continue
    const key = obligationKey(row.kind, row.name)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue

    const active = group.filter((row) => row.active)
    const ranked = [...(active.length > 0 ? active : group)].sort(
      (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)
    )
    const keeper = ranked[0]
    const duplicates = group.filter((row) => row.id !== keeper.id)

    for (const duplicate of duplicates) {
      const entries = await db
        .select()
        .from(obligationEntries)
        .where(eq(obligationEntries.obligationId, duplicate.id))

      for (const entry of entries) {
        const [existing] = await db
          .select()
          .from(obligationEntries)
          .where(
            and(
              eq(obligationEntries.obligationId, keeper.id),
              eq(obligationEntries.competence, entry.competence)
            )
          )
          .limit(1)

        if (!existing) {
          await db
            .update(obligationEntries)
            .set({ obligationId: keeper.id, userId: keeper.userId })
            .where(eq(obligationEntries.id, entry.id))
          continue
        }

        const paid = existing.paid || entry.paid
        await db
          .update(obligationEntries)
          .set({
            amount: mergeAmounts(existing.amount, entry.amount),
            paid,
            paidAt: paid ? (existing.paidAt ?? entry.paidAt) : null,
          })
          .where(eq(obligationEntries.id, existing.id))
        await db.delete(obligationEntries).where(eq(obligationEntries.id, entry.id))
      }

      await db.delete(obligations).where(eq(obligations.id, duplicate.id))
    }
  }
}

function mapEntry(row: typeof obligationEntries.$inferSelect): ObligationEntry {
  return {
    id: row.id,
    obligationId: row.obligationId,
    competence: row.competence,
    amount: row.amount,
    paid: row.paid,
    paidAt: row.paidAt,
  }
}

export async function listObligations(userId: string): Promise<Obligation[]> {
  await mergeDuplicateObligations(userId)
  const db = getDb()
  const rows = await db
    .select()
    .from(obligations)
    .where(await inHousehold(userId, obligations.userId))
    .orderBy(asc(obligations.sortOrder), asc(obligations.name))
  return rows.map(mapObligation)
}

export async function listObligationEntries(
  userId: string
): Promise<ObligationEntry[]> {
  await mergeDuplicateObligations(userId)
  const db = getDb()
  const rows = await db
    .select()
    .from(obligationEntries)
    .where(await inHousehold(userId, obligationEntries.userId))
    .orderBy(asc(obligationEntries.competence))
  return rows.map(mapEntry)
}

export async function ensureDefaultObligations(userId: string) {
  const db = getDb()
  const existing = await db
    .select({ id: obligations.id })
    .from(obligations)
    .where(await inHousehold(userId, obligations.userId))
    .limit(1)
  if (existing.length > 0) return

  await db.insert(obligations).values(
    DEFAULT_OBLIGATIONS.map((item, index) => ({
      userId,
      name: item.name,
      kind: item.kind,
      segment: item.segment,
      active: true,
      sortOrder: index,
    }))
  )
}

export async function createObligation(
  userId: string,
  input: { name: string; kind: ObligationKind; segment: SegmentId }
): Promise<Obligation> {
  const db = getDb()
  const name = input.name.trim()

  if (input.kind === "fixa" || input.kind === "variavel") {
    const existing = await db
      .select()
      .from(obligations)
      .where(await inHousehold(userId, obligations.userId))
    const match = existing.find(
      (row) =>
        row.active &&
        row.kind === input.kind &&
        obligationKey(row.kind, row.name) === obligationKey(input.kind, name)
    )
    if (match) return mapObligation(match)
  }

  const [maxRow] = await db
    .select({
      maxOrder: sql<number>`coalesce(max(${obligations.sortOrder}), -1)`.mapWith(
        Number
      ),
    })
    .from(obligations)
    .where(await inHousehold(userId, obligations.userId))

  const [row] = await db
    .insert(obligations)
    .values({
      userId,
      name,
      kind: input.kind,
      segment: input.segment,
      active: true,
      sortOrder: (maxRow?.maxOrder ?? -1) + 1,
    })
    .returning()
  return mapObligation(row)
}

export async function updateObligation(
  userId: string,
  id: string,
  patch: { name?: string; segment?: SegmentId; active?: boolean }
): Promise<Obligation | null> {
  const db = getDb()
  const [existing] = await db
    .select()
    .from(obligations)
    .where(and(await inHousehold(userId, obligations.userId), eq(obligations.id, id)))
    .limit(1)
  if (!existing) return null

  const [row] = await db
    .update(obligations)
    .set({
      name: patch.name?.trim() || existing.name,
      segment: patch.segment ?? existing.segment,
      active: patch.active ?? existing.active,
    })
    .where(and(await inHousehold(userId, obligations.userId), eq(obligations.id, id)))
    .returning()
  return row ? mapObligation(row) : null
}

export async function deactivateObligation(
  userId: string,
  id: string
): Promise<boolean> {
  const updated = await updateObligation(userId, id, { active: false })
  return updated !== null
}

export async function upsertObligationEntry(
  userId: string,
  obligationId: string,
  input: { competence: string; amount: number | null; paid: boolean }
): Promise<ObligationEntry> {
  const db = getDb()
  const [obligation] = await db
    .select({ id: obligations.id })
    .from(obligations)
    .where(and(await inHousehold(userId, obligations.userId), eq(obligations.id, obligationId)))
    .limit(1)
  if (!obligation) throw new Error("Dívida não encontrada.")

  const paidAt = input.paid ? new Date().toISOString().slice(0, 10) : null
  const [row] = await db
    .insert(obligationEntries)
    .values({
      userId,
      obligationId,
      competence: input.competence,
      amount: input.amount,
      paid: input.paid,
      paidAt,
    })
    .onConflictDoUpdate({
      target: [obligationEntries.obligationId, obligationEntries.competence],
      set: {
        amount: input.amount,
        paid: input.paid,
        paidAt,
      },
    })
    .returning()
  return mapEntry(row)
}

export async function copyPreviousObligationEntries(
  userId: string,
  kind: ObligationKind,
  competence: string
): Promise<ObligationEntry[]> {
  if (kind === "variavel") {
    throw new Error("Dívidas variáveis começam em branco de propósito.")
  }

  const previous = addMonthsToCompetence(competence, -1)
  const catalog = (await listObligations(userId)).filter(
    (item) => item.kind === kind && item.active
  )
  const entries = await listObligationEntries(userId)
  const copied: ObligationEntry[] = []

  for (const obligation of catalog) {
    const current = entries.find(
      (entry) =>
        entry.obligationId === obligation.id && entry.competence === competence
    )
    if (current && current.amount != null) continue

    const prior = entries.find(
      (entry) =>
        entry.obligationId === obligation.id && entry.competence === previous
    )
    if (!prior || prior.amount == null) continue

    copied.push(
      await upsertObligationEntry(userId, obligation.id, {
        competence,
        amount: prior.amount,
        paid: current?.paid ?? false,
      })
    )
  }

  return copied
}
