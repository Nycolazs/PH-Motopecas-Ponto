# Demo (Raspberry Pi) — ponto.yacacode.com

Ambiente de apresentação com dados fictícios (empresa Horizonte Soluções).

- Branch: `clientes/demo`. Marca em `packages/shared/src/brand.ts` e `packages/shared/brand/`.
- Imagens arm64 geradas pelo workflow **Entrega de clientes** (`deploy/release.json`).
- No Pi, a pasta `~/ph-ponto-demo` tem este `docker-compose.yml`, o `auto-update.sh` e o `.env`
  (senhas; nunca vai para o git).

## Cron no Pi

```cron
*/5 * * * * /home/nycolas/ph-ponto-demo/auto-update.sh >> /home/nycolas/ph-ponto-demo/update.log 2>&1
*/10 * * * * cd /home/nycolas/ph-ponto-demo && docker compose --profile seed run --rm -T live >> /home/nycolas/ph-ponto-demo/live.log 2>&1
```

Acesso: Cloudflare Tunnel `ponto.yacacode.com` → `http://localhost:8080` (painel e `/api`).

## Logins de demonstração

- Administrador: `admin` (senha no `.env` do Pi).
- Colaboradores: veja `apps/api/src/database/seed-demo-presentation.ts` (senha padrão de teste).
