import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema"

const globalForDb = globalThis as unknown as {
  __pg?: ReturnType<typeof postgres>
  __db?: ReturnType<typeof drizzle<typeof schema>>
}

function getConnectionString() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL não configurado.")
  }
  return url
}

export function getSql() {
  if (!globalForDb.__pg) {
    globalForDb.__pg = postgres(getConnectionString(), { max: 10 })
  }
  return globalForDb.__pg
}

export function getDb() {
  if (!globalForDb.__db) {
    globalForDb.__db = drizzle(getSql(), { schema })
  }
  return globalForDb.__db
}

export type Db = ReturnType<typeof getDb>
