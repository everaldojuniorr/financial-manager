import { createHmac, timingSafeEqual } from "node:crypto"

import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { getDb } from "@/db/client"
import { users } from "@/db/schema"

export const SESSION_COOKIE_NAME = "session"
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function getAuthSecret(): string {
  const value = process.env.AUTH_SECRET
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET deve ter pelo menos 32 caracteres.")
  }
  return value
}

type SessionPayload = {
  userId: string
  exp: number
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<{ userId: string } | null> {
  try {
    const db = getDb()
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1)
    if (!user) return null

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return null
    return { userId: user.id }
  } catch {
    return null
  }
}

export type CreateUserResult =
  | { ok: true; userId: string }
  | { ok: false; errors: string[] }

export async function createUser(
  username: string,
  password: string
): Promise<CreateUserResult> {
  const errors: string[] = []
  const normalized = username.trim()

  if (normalized.length < 3) {
    errors.push("O usuário precisa ter pelo menos 3 caracteres.")
  }
  if (normalized.length > 64) {
    errors.push("O usuário pode ter no máximo 64 caracteres.")
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(normalized)) {
    errors.push("Use apenas letras, números, ponto, hífen ou sublinhado.")
  }
  if (password.length < 6) {
    errors.push("A senha precisa ter pelo menos 6 caracteres.")
  }
  if (errors.length > 0) return { ok: false, errors }

  try {
    const db = getDb()
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, normalized))
      .limit(1)

    if (existing) {
      return { ok: false, errors: ["Este usuário já está em uso."] }
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const [created] = await db
      .insert(users)
      .values({ username: normalized, passwordHash })
      .returning({ id: users.id })

    return { ok: true, userId: created.id }
  } catch {
    return { ok: false, errors: ["Não foi possível criar a conta."] }
  }
}

export function createSessionToken(userId: string): string {
  const payload: SessionPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const signature = createHmac("sha256", getAuthSecret())
    .update(encoded)
    .digest("base64url")
  return `${encoded}.${signature}`
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [encoded, signature] = token.split(".")
    if (!encoded || !signature) return null

    const expected = createHmac("sha256", getAuthSecret())
      .update(encoded)
      .digest("base64url")

    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expected)
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null
    }

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as SessionPayload

    if (
      typeof payload.userId !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

export function hasSessionCookieShape(token: string | undefined): boolean {
  if (!token) return false
  const parts = token.split(".")
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0
}

export function sessionCookieOptions() {
  // Em HTTP (IP:3000 na VPS) o browser ignora cookies Secure.
  // Ative AUTH_COOKIE_SECURE=true somente atrás de HTTPS.
  const secure =
    process.env.AUTH_COOKIE_SECURE === "true" ||
    process.env.AUTH_COOKIE_SECURE === "1"

  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  }
}

export async function requireAuth(): Promise<
  { userId: string } | { error: NextResponse }
> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const session = token ? verifySessionToken(token) : null
  if (!session) {
    return {
      error: NextResponse.json({ errors: ["Não autenticado."] }, { status: 401 }),
    }
  }
  return { userId: session.userId }
}
