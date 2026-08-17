# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY PH-Motopeças-Ponto-Backend/package.json PH-Motopeças-Ponto-Backend/package.json
RUN --mount=type=cache,id=ph-ponto-pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter @ph-ponto/api...

FROM dependencies AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY PH-Motopeças-Ponto-Backend PH-Motopeças-Ponto-Backend
RUN pnpm --filter @ph-ponto/shared build \
  && pnpm --filter @ph-ponto/api build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY PH-Motopeças-Ponto-Backend/package.json PH-Motopeças-Ponto-Backend/package.json
RUN --mount=type=cache,id=ph-ponto-pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --prod --filter @ph-ponto/api... \
  && rm -rf /root/.cache/node/corepack \
  && mkdir -p /data/uploads \
  && chown -R node:node /data/uploads
COPY --from=build --chown=node:node /app/packages/shared/dist packages/shared/dist
COPY --from=build --chown=node:node /app/PH-Motopeças-Ponto-Backend/dist PH-Motopeças-Ponto-Backend/dist
COPY --chown=node:node PH-Motopeças-Ponto-Backend/prisma PH-Motopeças-Ponto-Backend/prisma
COPY --chown=node:node PH-Motopeças-Ponto-Backend/prisma.config.ts PH-Motopeças-Ponto-Backend/prisma.config.ts
COPY --chown=node:node PH-Motopeças-Ponto-Backend/docker-entrypoint.sh PH-Motopeças-Ponto-Backend/docker-entrypoint.sh
WORKDIR /app/PH-Motopeças-Ponto-Backend
USER node
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.API_PORT || '3333') + '/health/ready').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"
ENTRYPOINT ["/app/PH-Motopeças-Ponto-Backend/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
