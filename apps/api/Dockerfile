# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN --mount=type=cache,id=ph-ponto-pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter @ph-ponto/api...

FROM dependencies AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @ph-ponto/shared build \
  && pnpm --filter @ph-ponto/api build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN --mount=type=cache,id=ph-pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --prod --filter @ph-ponto/api... \
  && rm -rf /root/.cache/node/corepack \
  && mkdir -p /data/uploads \
  && chown -R node:node /data/uploads
COPY --from=build --chown=node:node /app/packages/shared/dist packages/shared/dist
COPY --from=build --chown=node:node /app/apps/api/dist apps/api/dist
COPY --chown=node:node apps/api/prisma apps/api/prisma
COPY --chown=node:node apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY --chown=node:node apps/api/docker-entrypoint.sh apps/api/docker-entrypoint.sh
WORKDIR /app/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.API_PORT || '3000') + '/health/ready').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"
ENTRYPOINT ["/app/apps/api/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
