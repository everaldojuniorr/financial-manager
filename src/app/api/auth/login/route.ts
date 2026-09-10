import { NextResponse } from "next/server"

import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifyCredentials,
} from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ errors: ["JSON inválido."] }, { status: 400 })
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ errors: ["Credenciais inválidas."] }, { status: 401 })
  }

  const { username, password } = body as Record<string, unknown>
  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ errors: ["Credenciais inválidas."] }, { status: 401 })
  }

  const user = await verifyCredentials(username, password)
  if (!user) {
    return NextResponse.json(
      { errors: ["Usuário ou senha incorretos."] },
      { status: 401 }
    )
  }

  let token: string
  try {
    token = createSessionToken(user.userId)
  } catch {
    return NextResponse.json(
      { errors: ["Autenticação não configurada no servidor."] },
      { status: 500 }
    )
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions())
  return response
}
