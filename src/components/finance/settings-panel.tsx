"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LogOut, Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { THEME_STORAGE_KEY } from "@/lib/theme"

type HouseholdPayload = {
  household: { id: string; name: string } | null
  members: { id: string; username: string; email: string; phone: string }[]
  invites: {
    received: { id: string; inviter: string; householdName: string }[]
    sent: { id: string; invitee: string }[]
  }
}

function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  })
  return () => observer.disconnect()
}

export function SettingsPanel({ onChanged }: { onChanged?: () => void }) {
  const router = useRouter()
  const [data, setData] = React.useState<HouseholdPayload | null>(null)
  const [username, setUsername] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [contactError, setContactError] = React.useState<string | null>(null)
  const [contactSaved, setContactSaved] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const isDark = React.useSyncExternalStore(
    subscribeToTheme,
    () => document.documentElement.classList.contains("dark"),
    () => false
  )

  const load = React.useCallback(async () => {
    const [householdResponse, profileResponse] = await Promise.all([
      fetch("/api/household", { cache: "no-store" }),
      fetch("/api/profile", { cache: "no-store" }),
    ])
    if (householdResponse.ok) {
      setData((await householdResponse.json()) as HouseholdPayload)
    }
    if (profileResponse.ok) {
      const payload = (await profileResponse.json()) as {
        profile: { email: string; phone: string }
      }
      setEmail(payload.profile.email)
      setPhone(payload.profile.phone)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  async function saveContact(event: React.FormEvent) {
    event.preventDefault()
    setContactError(null)
    setContactSaved(false)
    setBusy(true)
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          errors?: string[]
        } | null
        setContactError(payload?.errors?.[0] ?? "Não foi possível salvar o contato.")
        return
      }
      setContactSaved(true)
      await load()
    } finally {
      setBusy(false)
    }
  }

  function setTheme(dark: boolean) {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light")
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const response = await fetch("/api/household/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          errors?: string[]
        } | null
        setError(payload?.errors?.[0] ?? "Não foi possível enviar o convite.")
        return
      }
      setUsername("")
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function respond(id: string, accept: boolean) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/household/invites/${id}/${accept ? "accept" : "decline"}`,
        { method: "POST" }
      )
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          errors?: string[]
        } | null
        setError(payload?.errors?.[0] ?? "Não foi possível responder ao convite.")
        return
      }
      await load()
      onChanged?.()
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.replace("/login")
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Aparência</CardTitle>
          <CardDescription>O tema fica salvo neste navegador.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button
            variant={isDark ? "outline" : "secondary"}
            onClick={() => setTheme(false)}
          >
            <Sun />
            Claro
          </Button>
          <Button
            variant={isDark ? "secondary" : "outline"}
            onClick={() => setTheme(true)}
          >
            <Moon />
            Escuro
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Contato</CardTitle>
          <CardDescription>
            E-mail e celular desta conta. Podem ficar em branco.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={saveContact}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-email">E-mail</Label>
              <Input
                id="profile-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@email.com"
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-phone">Celular</Label>
              <Input
                id="profile-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="(11) 99999-9999"
                disabled={busy}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={busy}>
                Salvar contato
              </Button>
              {contactSaved ? (
                <p className="text-sm text-muted-foreground">Contato salvo.</p>
              ) : null}
              {contactError ? (
                <p className="text-sm text-destructive" role="alert">
                  {contactError}
                </p>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Casa</CardTitle>
          <CardDescription>
            Depois do aceite, os dois painéis mostram todos os lançamentos, faturas e
            dívidas — inclusive os pessoais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data?.members.length ? (
            <ul className="space-y-2">
              {data.members.map((member) => (
                <li key={member.id} className="rounded-lg border px-3 py-2 text-sm">
                  <p className="font-medium">{member.username}</p>
                  <p className="text-muted-foreground">
                    {member.email || "Sem e-mail"} · {member.phone || "Sem celular"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Você ainda não compartilha o painel com ninguém.
            </p>
          )}

          <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={invite}>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="invite-username">Convidar usuário</Label>
              <Input
                id="invite-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="usuario"
                disabled={busy}
              />
            </div>
            <Button type="submit" disabled={busy || username.trim().length < 3}>
              Enviar convite
            </Button>
          </form>

          {data?.invites.received.map((invite) => (
            <div
              key={invite.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
            >
              <p className="text-sm">
                <span className="font-medium">{invite.inviter}</span> convidou você para{" "}
                {invite.householdName}.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => respond(invite.id, true)} disabled={busy}>
                  Aceitar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => respond(invite.id, false)}
                  disabled={busy}
                >
                  Recusar
                </Button>
              </div>
            </div>
          ))}

          {data?.invites.sent.map((invite) => (
            <p key={invite.id} className="text-sm text-muted-foreground">
              Convite pendente para {invite.invitee}.
            </p>
          ))}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Sessão</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={logout}>
            <LogOut />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
