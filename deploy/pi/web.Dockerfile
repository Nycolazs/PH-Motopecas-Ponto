# syntax=docker/dockerfile:1.7
# Web panel for the Raspberry Pi demo: the API is reached through the same origin at /api.
FROM node:24-alpine AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV VITE_API_BASE_URL=/api
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/desktop/package.json apps/desktop/package.json
RUN --mount=type=cache,id=ph-pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter @ph-ponto/desktop...

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/desktop apps/desktop
RUN pnpm --filter @ph-ponto/shared build \
  && pnpm --filter @ph-ponto/desktop build:renderer

FROM nginx:alpine AS runtime
COPY deploy/pi/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/pi/api-proxy.inc /etc/nginx/conf.d/api-proxy.inc
COPY --from=build /app/apps/desktop/dist/renderer /usr/share/nginx/html
EXPOSE 80 81
CMD ["nginx", "-g", "daemon off;"]
