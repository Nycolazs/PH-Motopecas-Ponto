#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${APP_DIR}"

FORCE_UPDATE=false
if [[ "${1:-}" == "--force" || "${1:-}" == "-f" ]]; then
  FORCE_UPDATE=true
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ====================================================="
echo "[$(date '+%Y-%m-%d %H:%M:%S')] PH-Ponto: Verificando atualizações no GitHub..."

# 1. Fetch remote changes
git fetch origin main --quiet

LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/main)

if [[ "${LOCAL_COMMIT}" == "${REMOTE_COMMIT}" && "${FORCE_UPDATE}" == false ]]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Repositório já está atualizado (${LOCAL_COMMIT:0:7}). Nenhuma ação necessária."
  exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Nova versão detectada! Atualizando de ${LOCAL_COMMIT:0:7} para ${REMOTE_COMMIT:0:7}..."

# 2. Pull latest code
echo "[$(date '+%Y-%m-%d %H:%M:%S')] [1/5] Baixando alterações do repositório GitHub..."
git pull origin main

# 3. Install dependencies and compile
echo "[$(date '+%Y-%m-%d %H:%M:%S')] [2/5] Instalando dependências..."
pnpm install --frozen-lockfile

echo "[$(date '+%Y-%m-%d %H:%M:%S')] [3/5] Compilando contratos compartilhados e backend..."
pnpm --filter @ph-ponto/shared build
pnpm --filter @ph-ponto/api build

# 4. Apply database migrations
echo "[$(date '+%Y-%m-%d %H:%M:%S')] [4/5] Aplicando migrações do banco de dados (Prisma)..."
pnpm --filter @ph-ponto/api db:migrate:deploy

# 5. Restart backend service
echo "[$(date '+%Y-%m-%d %H:%M:%S')] [5/5] Reiniciando serviço da API..."
if systemctl --user is-active --quiet ph-ponto-backend.service 2>/dev/null || systemctl --user is-enabled --quiet ph-ponto-backend.service 2>/dev/null; then
  systemctl --user restart ph-ponto-backend.service
  echo "✓ Serviço systemd (ph-ponto-backend.service) reiniciado com sucesso."
elif command -v pm2 &> /dev/null && pm2 list | grep -q "ph-ponto-api"; then
  pm2 restart ph-ponto-api
  echo "✓ Serviço PM2 reiniciado com sucesso."
else
  echo "✓ Código atualizado e migrado. Reinicie o processo da API caso necessário."
fi

# 6. Verify health
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Validando inicialização da API..."
MAX_RETRIES=15
PORT="${API_PORT:-3333}"
HEALTHY=false

for i in $(seq 1 $MAX_RETRIES); do
  sleep 2
  if curl -s -f "http://127.0.0.1:${PORT}/health/ready" > /dev/null 2>&1; then
    HEALTHY=true
    break
  fi
  echo "Aguardando inicialização da API (tentativa $i/$MAX_RETRIES)..."
done

if [[ "${HEALTHY}" == true ]]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ API está saudável e respondendo na porta ${PORT}!"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ API demorou para responder ao health check. Verifique os logs com: journalctl --user -u ph-ponto-backend.service -n 50"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ====================================================="
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Atualização concluída com sucesso!"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ====================================================="
