import { NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth"
import { getProfile, updateProfileContact, validateContact } from "@/lib/profile"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAuth()
  if ("error" in auth) return auth.error

  const profile = await getProfile(auth.userId)
  if (!profile) {
    return NextResponse.json({ errors: ["Perfil não encontrado."] }, { status: 404 })
  }

  return NextResponse.json({ profile })
}

export async function PUT(request: Request) {
  const auth = await requireAuth()
  if ("error" in auth) return auth.error

  const body = await request.json().catch(() => null)
  const contact = validateContact(body ?? {})
  if ("error" in contact) {
    return NextResponse.json({ errors: [contact.error] }, { status: 400 })
  }

  const profile = await updateProfileContact(auth.userId, contact)
  if (!profile) {
    return NextResponse.json({ errors: ["Perfil não encontrado."] }, { status: 404 })
  }

  return NextResponse.json({ profile })
}
