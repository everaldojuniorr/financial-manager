import { and, eq, inArray } from "drizzle-orm"
import type { AnyColumn } from "drizzle-orm"

import { getDb } from "@/db/client"
import { householdInvites, householdMembers, households, users } from "@/db/schema"

export function memberFilter(column: AnyColumn, memberIds: string[]) {
  if (memberIds.length === 1) return eq(column, memberIds[0])
  return inArray(column, memberIds)
}

export async function householdUserIds(userId: string): Promise<string[]> {
  const db = getDb()
  const [membership] = await db
    .select({ householdId: householdMembers.householdId })
    .from(householdMembers)
    .where(eq(householdMembers.userId, userId))
    .limit(1)

  if (!membership) return [userId]

  const rows = await db
    .select({ userId: householdMembers.userId })
    .from(householdMembers)
    .where(eq(householdMembers.householdId, membership.householdId))

  const ids = rows.map((row) => row.userId)
  return ids.length > 0 ? ids : [userId]
}

export async function getHouseholdForUser(userId: string) {
  const db = getDb()
  const [membership] = await db
    .select({
      householdId: householdMembers.householdId,
      name: households.name,
    })
    .from(householdMembers)
    .innerJoin(households, eq(households.id, householdMembers.householdId))
    .where(eq(householdMembers.userId, userId))
    .limit(1)

  if (!membership) {
    return {
      household: null,
      members: [] as { id: string; username: string; email: string; phone: string }[],
    }
  }

  const members = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      phone: users.phone,
    })
    .from(householdMembers)
    .innerJoin(users, eq(users.id, householdMembers.userId))
    .where(eq(householdMembers.householdId, membership.householdId))

  return {
    household: { id: membership.householdId, name: membership.name },
    members,
  }
}

export async function listPendingInvites(userId: string) {
  const db = getDb()
  const received = await db
    .select({
      id: householdInvites.id,
      status: householdInvites.status,
      inviter: users.username,
      householdName: households.name,
    })
    .from(householdInvites)
    .innerJoin(users, eq(users.id, householdInvites.inviterId))
    .innerJoin(households, eq(households.id, householdInvites.householdId))
    .where(
      and(eq(householdInvites.inviteeId, userId), eq(householdInvites.status, "pendente"))
    )

  const sent = await db
    .select({
      id: householdInvites.id,
      status: householdInvites.status,
      invitee: users.username,
    })
    .from(householdInvites)
    .innerJoin(users, eq(users.id, householdInvites.inviteeId))
    .where(
      and(eq(householdInvites.inviterId, userId), eq(householdInvites.status, "pendente"))
    )

  return { received, sent }
}

export async function inviteToHousehold(inviterId: string, username: string) {
  const normalized = username.trim()
  if (normalized.length < 3) {
    return { ok: false as const, errors: ["Informe o usuário de quem você quer convidar."] }
  }

  const db = getDb()
  const [invitee] = await db
    .select()
    .from(users)
    .where(eq(users.username, normalized))
    .limit(1)

  if (!invitee) {
    return { ok: false as const, errors: ["Usuário não encontrado."] }
  }
  if (invitee.id === inviterId) {
    return { ok: false as const, errors: ["Você não pode convidar a si mesmo."] }
  }

  const [inviteeMembership] = await db
    .select()
    .from(householdMembers)
    .where(eq(householdMembers.userId, invitee.id))
    .limit(1)
  if (inviteeMembership) {
    return { ok: false as const, errors: ["Essa pessoa já faz parte de uma casa."] }
  }

  const [pending] = await db
    .select()
    .from(householdInvites)
    .where(
      and(
        eq(householdInvites.inviteeId, invitee.id),
        eq(householdInvites.status, "pendente")
      )
    )
    .limit(1)
  if (pending) {
    return { ok: false as const, errors: ["Já existe um convite pendente para essa pessoa."] }
  }

  let householdId: string
  const [mine] = await db
    .select()
    .from(householdMembers)
    .where(eq(householdMembers.userId, inviterId))
    .limit(1)

  if (mine) {
    householdId = mine.householdId
  } else {
    const [created] = await db
      .insert(households)
      .values({ name: "Casa" })
      .returning()
    householdId = created.id
    await db.insert(householdMembers).values({ householdId, userId: inviterId })
  }

  await db.insert(householdInvites).values({
    householdId,
    inviterId,
    inviteeId: invitee.id,
    status: "pendente",
  })

  return { ok: true as const }
}

export async function respondToInvite(
  userId: string,
  inviteId: string,
  accept: boolean
) {
  const db = getDb()
  const [invite] = await db
    .select()
    .from(householdInvites)
    .where(
      and(
        eq(householdInvites.id, inviteId),
        eq(householdInvites.inviteeId, userId),
        eq(householdInvites.status, "pendente")
      )
    )
    .limit(1)

  if (!invite) {
    return { ok: false as const, errors: ["Convite não encontrado."] }
  }

  if (!accept) {
    await db
      .update(householdInvites)
      .set({ status: "recusado" })
      .where(eq(householdInvites.id, invite.id))
    return { ok: true as const }
  }

  const [existing] = await db
    .select()
    .from(householdMembers)
    .where(eq(householdMembers.userId, userId))
    .limit(1)
  if (existing) {
    return { ok: false as const, errors: ["Você já faz parte de uma casa."] }
  }

  await db.insert(householdMembers).values({
    householdId: invite.householdId,
    userId,
  })
  await db
    .update(householdInvites)
    .set({ status: "aceito" })
    .where(eq(householdInvites.id, invite.id))

  return { ok: true as const }
}
