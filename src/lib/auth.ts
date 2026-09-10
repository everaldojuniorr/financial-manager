import { createHmac, timingSafeEqual } from "node:crypto"

import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const SESSION_COOKIE_NAME = "session"
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function getAuthUsername(): string {
  const value = process.env.AUTH_USERNAME
  if (!value) {
    throw new Error("AUTH_USERNAME não configurado.")
  }
  return value
}

function getAuthPassword(): string {
  const value = process.env.AUTH_PASSWORD
  if (!value) {
    throw new Error("AUTH_PASSWORD não configurado.")
  }
  return value
}

function getAuthSecret(): string {
  const value = process.env.AUTH_SECRET
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET deve ter pelo menos 32 caracteres.")
  }
  return value
}

function hmac(value: string): Buffer {
  return createHmac("sha256", getAuthSecret()).update(value).digest()
}

function secureCompare(a: string, b: string): boolean {
  const left = hmac(a)
  const right = hmac(b)
  return timingSafeEqual(left, right)
}

export function verifyCredentials(username: string, password: string): boolean {
  try {
    const userOk = secureCompare(username, getAuthUsername())
    const passOk = secureCompare(password, getAuthPassword())
    return userOk && passOk
  } catch {
    return false
  }
}

export function createSessionToken(): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
  const payload = String(exp)
  const signature = createHmac("sha256", getAuthSecret())
    .update(payload)
    .digest("base64url")
  return `${payload}.${signature}`
}

export function verifySessionToken(token: string): boolean {
  try {
    const [payload, signature] = token.split(".")
    if (!payload || !signature) return false

    const expected = createHmac("sha256", getAuthSecret())
      .update(payload)
      .digest("base64url")

    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expected)
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return false
    }

    const exp = Number(payload)
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
      return false
    }

    return true
  } catch {
    return false
  }
}

export function hasSessionCookieShape(token: string | undefined): boolean {
  if (!token) return false
  const parts = token.split(".")
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  }
}

export async function requireAuth(): Promise<NextResponse | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ errors: ["Não autenticado."] }, { status: 401 })
  }
  return null
}
