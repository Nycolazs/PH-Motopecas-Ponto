# PH Motopeças — produção

- Servidor próprio da PH (Docker Compose na raiz do repositório: `docker-compose.yml`).
- Hoje o servidor ainda faz deploy automático da branch **`main`** (legado), pelo cron
  `ops/server/auto-deploy.sh`. Esta branch (`clientes/ph-motopecas`) é a sucessora: mesma marca,
  mesmo app desktop (mesmo `appId` e feed de atualização), com o núcleo novo (`develop`).

## Migrar o servidor para esta branch (quando aprovado)

1. Conferir a `develop` em homologação (demo) e as migrações novas.
2. Fazer backup do banco (`~/backups/backup.sh`).
3. No servidor, apontar o deploy automático para `clientes/ph-motopecas`
   (variável `DEPLOY_BRANCH` do `ops/server/auto-deploy.sh`).
4. Acompanhar `~/deploy.log` até "Deploy concluído".

O título do painel continua "PH-Ponto · PH Motopeças", então a verificação de saúde do deploy
continua válida.
