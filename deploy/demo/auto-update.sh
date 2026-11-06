#!/usr/bin/env bash
# Keeps the demo on the newest images of the clientes/demo branch. Run by cron every 5 minutes:
#   */5 * * * * /home/nycolas/ph-ponto-demo/auto-update.sh >> /home/nycolas/ph-ponto-demo/update.log 2>&1
# Only restarts when an image changed; seeds and PDFs are refreshed after an update.
set -uo pipefail
cd "$(dirname "$0")" || exit 1
exec 9>.auto-update.lock
flock -n 9 || exit 0

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

images=(ghcr.io/nycolazs/ph-ponto-demo-api:latest ghcr.io/nycolazs/ph-ponto-demo-web:latest ghcr.io/nycolazs/ph-ponto-demo-seed:latest)
before=$(for image in "${images[@]}"; do docker image inspect -f '{{.Id}}' "$image" 2>/dev/null; done)
if ! docker compose --profile seed pull -q >/tmp/demo-pull.log 2>&1; then
  log "AVISO: falha ao baixar imagens: $(tail -n 3 /tmp/demo-pull.log | tr '\n' ' ')"
  exit 1
fi
after=$(for image in "${images[@]}"; do docker image inspect -f '{{.Id}}' "$image" 2>/dev/null; done)
[ "$before" = "$after" ] && exit 0

revision=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' ghcr.io/nycolazs/ph-ponto-demo-api:latest 2>/dev/null)
log "Novas imagens (commit ${revision:-?}). Atualizando..."
if ! docker compose up -d --wait --wait-timeout 300; then
  log "ERRO: os serviços não ficaram saudáveis. Veja: docker compose ps; docker compose logs api"
  exit 1
fi
docker compose --profile seed run --rm -T seed >/dev/null 2>&1 || log "AVISO: seed falhou"
docker compose --profile seed run --rm -T render-docs >/dev/null 2>&1 || log "AVISO: PDFs de demonstração falharam"
docker image prune -f >/dev/null 2>&1 || true
log "Atualização concluída (commit ${revision:-?})."
