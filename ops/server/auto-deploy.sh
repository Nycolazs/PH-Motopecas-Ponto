#!/usr/bin/env bash
# PH-Ponto production auto-deploy, run every minute by cron on the server:
#   * * * * * /home/nyc/app/scripts/auto-deploy.sh >> /home/nyc/deploy.log 2>&1
# (that path is a tiny wrapper that execs this versioned script).
#
# A commit is only recorded as deployed after the API and the web panel are
# healthy. Failed deploys are retried every RETRY_AFTER_SECONDS instead of being
# silently skipped on the next run.
set -uo pipefail

APP_DIR="${APP_DIR:-/home/nyc/app}"
STATE_DIR="${STATE_DIR:-/home/nyc/.ph-ponto-deploy}"
RETRY_AFTER_SECONDS="${RETRY_AFTER_SECONDS:-600}"
API_CONTAINER="${API_CONTAINER:-ph-ponto-api-1}"
WEB_URL="${WEB_URL:-http://127.0.0.1:5173/}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

mkdir -p "$STATE_DIR"
exec 9>"$STATE_DIR/deploy.lock"
flock -n 9 || exit 0

cd "$APP_DIR" || { log "ERRO: diretório $APP_DIR não encontrado."; exit 1; }

if ! git fetch origin main --quiet 2>"$STATE_DIR/fetch.err"; then
  # Network hiccups are common; only log when they persist (marker older than 10 min).
  if [ ! -f "$STATE_DIR/fetch-failing" ]; then touch "$STATE_DIR/fetch-failing"; fi
  if [ -n "$(find "$STATE_DIR/fetch-failing" -mmin +10 2>/dev/null)" ]; then
    log "AVISO: git fetch falhando há mais de 10 minutos: $(tr '\n' ' ' <"$STATE_DIR/fetch.err")"
    touch "$STATE_DIR/fetch-failing"
  fi
  exit 1
fi
rm -f "$STATE_DIR/fetch-failing"

REMOTE_COMMIT="$(git rev-parse origin/main)"
DEPLOYED_COMMIT="$(cat "$STATE_DIR/deployed-commit" 2>/dev/null || true)"
[ "$REMOTE_COMMIT" = "$DEPLOYED_COMMIT" ] && exit 0

if [ -f "$STATE_DIR/failed-commit" ] && [ "$(cat "$STATE_DIR/failed-commit")" = "$REMOTE_COMMIT" ]; then
  last_failure=$(stat -c %Y "$STATE_DIR/failed-commit")
  if [ $(( $(date +%s) - last_failure )) -lt "$RETRY_AFTER_SECONDS" ]; then exit 0; fi
  log "Tentando novamente o deploy de $REMOTE_COMMIT que falhou anteriormente."
fi

fail() {
  log "DEPLOY FALHOU para $REMOTE_COMMIT: $1"
  echo "$REMOTE_COMMIT" >"$STATE_DIR/failed-commit"
  exit 1
}

log "Novo commit na main: $REMOTE_COMMIT (implantado: ${DEPLOYED_COMMIT:-nenhum}). Atualizando..."
git reset --hard origin/main --quiet || fail "git reset"

docker compose build || fail "docker compose build"
docker compose up -d || fail "docker compose up"

healthy=""
for _ in $(seq 1 90); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$API_CONTAINER" 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then healthy="yes"; break; fi
  sleep 2
done
[ -n "$healthy" ] || fail "API não ficou saudável (último estado: ${status:-desconhecido}). Logs: docker logs $API_CONTAINER"

# nginx needs a few seconds after the container is recreated; poll instead of a single try
# (a single try failed right after start and made every deploy retry every 10 minutes).
web_ok=""
for _ in $(seq 1 30); do
  if grep -q "<title>PH-Ponto" <(curl -fsS -m 10 "$WEB_URL" 2>/dev/null); then web_ok="yes"; break; fi
  sleep 2
done
[ -n "$web_ok" ] || fail "painel web não respondeu com o PH-Ponto em $WEB_URL"

echo "$REMOTE_COMMIT" >"$STATE_DIR/deployed-commit"
rm -f "$STATE_DIR/failed-commit"
docker image prune -f --filter "until=24h" >/dev/null 2>&1 || true
log "Deploy concluído com sucesso no commit $REMOTE_COMMIT."
