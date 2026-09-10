import { eq } from "drizzle-orm"

import { getDb } from "@/db/client"
import { users } from "@/db/schema"

export type Profile = {
  id: string
  username: string
  email: string
  phone: string
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const db = getDb()
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      phone: users.phone,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return user ?? null
}

export async function updateProfileContact(
  userId: string,
  contact: { email: string; phone: string },
): Promise<Profile | null> {
  const db = getDb()
  const [user] = await db
    .update(users)
    .set({ email: contact.email, phone: contact.phone })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      phone: users.phone,
    })

  return user ?? null
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateContact(input: { email?: unknown; phone?: unknown }):
  | { email: string; phone: string }
  | { error: string } {
  const email = typeof input.email === "string" ? input.email.trim() : ""
  const phone = typeof input.phone === "string" ? input.phone.trim() : ""

  if (email.length > 160) return { error: "E-mail muito longo." }
  if (email && !EMAIL.test(email)) return { error: "E-mail inválido." }

  const digits = phone.replace(/\D/g, "")
  if (phone.length > 32) return { error: "Celular muito longo." }
  if (phone && (digits.length < 10 || digits.length > 13)) {
    return { error: "Celular inválido. Use DDD e número." }
  }

  return { email, phone }
}
