import { config } from "dotenv"
config({ path: ".env.local" })
config()

import { migrate } from "drizzle-orm/postgres-js/migrator"

import { getDb, getSql } from "../src/db/client"

async function main() {
  const db = getDb()
  await migrate(db, { migrationsFolder: "./drizzle" })
  console.log("[migrate] Migrations aplicadas.")
  await getSql().end({ timeout: 5 })
  process.exit(0)
}

main().catch(async (error) => {
  console.error("[migrate] Falhou:", error)
  try {
    await getSql().end({ timeout: 5 })
  } catch {
    // ignore
  }
  process.exit(1)
})
