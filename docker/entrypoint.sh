#!/bin/sh
set -e

echo "[entrypoint] Aplicando migrations…"
npx tsx scripts/migrate.ts

echo "[entrypoint] Seed idempotente…"
npx tsx scripts/seed.ts

echo "[entrypoint] Iniciando Next.js…"
exec node server.js
