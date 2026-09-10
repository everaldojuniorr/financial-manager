import { NextResponse } from "next/server"

import {
  createSessionToken,
  createUser,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
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
    return NextResponse.json({ errors: ["Dados inválidos."] }, { status: 400 })
  }

  const { username, password, confirmPassword } = body as Record<string, unknown>
  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ errors: ["Informe usuário e senha."] }, { status: 400 })
  }

  if (typeof confirmPassword === "string" && password !== confirmPassword) {
    return NextResponse.json(
      { errors: ["A confirmação de senha não confere."] },
      { status: 422 }
    )
  }

  const created = await createUser(username, password)
  if (!created.ok) {
    return NextResponse.json({ errors: created.errors }, { status: 422 })
  }

  let token: string
  try {
    token = createSessionToken(created.userId)
  } catch {
    return NextResponse.json(
      { errors: ["Conta criada, mas a sessão falhou. Faça login."] },
      { status: 500 }
    )
  }

  const response = NextResponse.json({ ok: true }, { status: 201 })
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions())
  return response
}
