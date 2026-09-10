#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STATE_DIR="$ROOT/.deploy"
STATE_FILE="$STATE_DIR/active"
CADDYFILE="$ROOT/docker/caddy/Caddyfile"
DOMAIN="${APP_DOMAIN:-financyexpert.com}"

mkdir -p "$STATE_DIR" "$(dirname "$CADDYFILE")"

write_caddy() {
  slot="$1"
  # Grava no mesmo inode. `mv` troca o arquivo e o bind mount do Caddy
  # continua vendo a config antiga até o container ser recriado.
  cat > "$CADDYFILE" <<EOF
${DOMAIN}, www.${DOMAIN} {
	reverse_proxy app-${slot}:3000
}
EOF
}

proxy_targets() {
  slot="$1"
  docker compose exec -T proxy wget -q -O - http://127.0.0.1:2019/config/ 2>/dev/null \
    | grep -F "app-${slot}:3000" >/dev/null 2>&1
}

recreate_proxy() {
  docker compose up -d --force-recreate --no-deps proxy
}

point_proxy() {
  slot="$1"
  write_caddy "$slot"
  echo "[deploy] Recriando o proxy para app-$slot."
  recreate_proxy
  i=0
  while [ "$i" -lt 20 ]; do
    if proxy_targets "$slot"; then
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  return 1
}

smoke_proxy() {
  i=0
  while [ "$i" -lt 30 ]; do
    if command -v curl >/dev/null 2>&1; then
      if curl -fsS -o /dev/null --max-time 10 \
        --resolve "${DOMAIN}:443:127.0.0.1" \
        "https://${DOMAIN}/login"; then
        return 0
      fi
    elif command -v wget >/dev/null 2>&1; then
      if wget -q -O /dev/null -T 10 "https://${DOMAIN}/login"; then
        return 0
      fi
    fi
    i=$((i + 1))
    sleep 2
  done
  return 1
}

smoke() {
  slot="$1"
  if [ "$slot" = "green" ]; then
    docker compose --profile green exec -T app-green node -e \
      "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"
  else
    docker compose exec -T app-blue node -e \
      "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"
  fi
}

slot_cmd() {
  slot="$1"
  shift
  if [ "$slot" = "green" ]; then
    docker compose --profile green "$@" app-green
  else
    docker compose "$@" app-blue
  fi
}

fail_slot() {
  slot="$1"
  echo "[deploy] Slot app-$slot falhou. A aplicação ativa permanece no ar."
  slot_cmd "$slot" logs --tail 80 || true
  slot_cmd "$slot" stop || true
  slot_cmd "$slot" rm -f || true
  exit 1
}

active=""
if [ -f "$STATE_FILE" ]; then
  active="$(tr -d '[:space:]' < "$STATE_FILE")"
fi

case "$active" in
  blue) next=green ;;
  green) next=blue ;;
  *)
    next=blue
    active=""
    ;;
esac

echo "[deploy] Ativo=${active:-nenhum} próximo=$next"

docker compose up -d --wait db

if [ ! -f "$CADDYFILE" ]; then
  write_caddy "${active:-blue}"
fi

echo "[deploy] Build da imagem (slot atual continua servindo)…"
docker compose build app-blue

if ! slot_cmd "$next" up -d --no-deps --wait; then
  fail_slot "$next"
fi

echo "[deploy] Smoke check em app-$next…"
if ! smoke "$next"; then
  fail_slot "$next"
fi

# Primeira troca a partir do compose antigo: o serviço `app` ainda ocupa a porta 3000.
legacy="$(docker ps --filter "name=financial-manager-app-1" --format '{{.ID}}' || true)"
if [ -n "$legacy" ]; then
  echo "[deploy] Parando container legado financial-manager-app-1 para liberar a porta 3000."
  docker stop "$legacy"
fi

if ! point_proxy "$next"; then
  echo "[deploy] Proxy não apontou para app-$next."
  if [ -n "$active" ]; then
    point_proxy "$active" || echo "[deploy] Não foi possível devolver o proxy para app-$active."
  fi
  fail_slot "$next"
fi

echo "[deploy] Smoke check pelo proxy em https://${DOMAIN}/login…"
if ! smoke_proxy; then
  echo "[deploy] Proxy não respondeu /login para app-$next."
  if [ -n "$active" ]; then
    point_proxy "$active" || echo "[deploy] Não foi possível devolver o proxy para app-$active."
  fi
  fail_slot "$next"
fi

printf '%s\n' "$next" > "$STATE_FILE"
echo "[deploy] Tráfego apontando para app-$next."

if [ -n "$active" ] && [ "$active" != "$next" ]; then
  echo "[deploy] Encerrando slot antigo app-$active…"
  slot_cmd "$active" stop || true
  slot_cmd "$active" rm -f || true
fi

docker image prune -f
echo "[deploy] Concluído. Ativo=$next"
